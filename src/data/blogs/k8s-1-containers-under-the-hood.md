## Introduction

The training did not start with `docker run`. It started with `chroot`. That choice, week one, day one, turned out to be the single most useful pedagogical decision in the whole course, because it dissolves the magic. After you have built a container by hand from a directory and a few `cp` commands, you stop thinking of containers as a thing Docker does and start thinking of them as a **set of Linux kernel features layered on top of an ordinary process**.

This post walks through the seven `container-demos/` scripts that opened the training. I will skip the bash plumbing and focus on what each demo proves about the kernel.

> **The demo scripts are in the training repo at `container-demos/demo-0[1-7]-*.sh`.** They use `pv`, `pax-utils` (`lddtree`), `cgroup-tools`, `strace`, `tree` and Docker, install these on a Linux VM and you can run all of them yourself.

---

## Table of Contents

1. [`chroot`: a filesystem the process can see](#chroot-a-filesystem-the-process-can-see)
2. [Namespaces: who am I, what can I see?](#namespaces-who-am-i-what-can-i-see)
3. [cgroups: how much can I have?](#cgroups-how-much-can-i-have)
4. [Capabilities: what is `root` allowed to do?](#capabilities-what-is-root-allowed-to-do)
5. [seccomp: which syscalls can I make?](#seccomp-which-syscalls-can-i-make)
6. [overlayfs: the secret behind image layers](#overlayfs-the-secret-behind-image-layers)
7. [Putting it together: a container is a process](#putting-it-together-a-container-is-a-process)

---

## `chroot`: a filesystem the process can see

The first demo creates a directory `~/container101`, copies `bash`, `ls`, `ps` into it together with their dynamic libraries, mounts a `/proc` filesystem, and then `chroot`s in:

```bash
mkdir -p ~/container101 && cd ~/container101
mkdir bin lib lib64
cp /bin/bash ./bin
ldd bin/bash                 # discover which .so files bash needs
copywithlib.sh /bin/bash     # copy bash + every lib it depends on
copywithlib.sh /bin/ls
copywithlib.sh /bin/ps
mkdir proc && sudo mount -t proc proc proc

sudo chroot . /bin/bash
# inside the chroot:
pwd        # /
ls -al /   # only the files we copied!
cd ../..   # we hit the root, can't escape
ps -ef     # uh-oh, we still see ALL host processes
```

Two lessons in 20 lines:

1. **A binary is useless without its libraries.** `ldd /bin/bash` shows `libc.so.6`, `ld-linux-x86-64.so.2`, etc. If `lib/` does not contain those, `chroot . /bin/bash` fails with `No such file or directory` even though `bin/bash` is right there. **This is why every Dockerfile starts with `FROM <something>`**, that something is the userspace your binary needs to find at runtime. `FROM scratch` works only for fully static binaries (Go binaries built without cgo, for example).
2. **`chroot` only isolates the filesystem.** `ps -ef` inside still lists every process on the host. The PID namespace, network namespace, mount namespace, none of those move when you `chroot`. So `chroot` is the filesystem half of a container, not the whole thing.

> **The "wait, why?" moment** I had to chase down after class: *"Why can't I just run a `CMD` in a Dockerfile from scratch?"*, because the binary you `CMD` needs `/lib/x86_64-linux-gnu/libc.so.6` (or wherever its loader expects libc) to even start, and `FROM scratch` does not give you that.

---

## Namespaces: who am I, what can I see?

`chroot` only isolates the filesystem. The other dimensions, process tree, network stack, user IDs, hostname, IPC, are isolated by **namespaces**, controlled by `unshare(2)` and `clone(2)` syscalls. Linux currently has 8 namespace types:

| Namespace | Isolates | Try it with |
|---|---|---|
| `mnt` | mount points | `unshare --mount` |
| `pid` | process IDs (your bash becomes PID 1) | `unshare --pid --fork --mount-proc` |
| `net` | network interfaces, routing, ports | `unshare --net` |
| `ipc` | System V IPC, POSIX message queues | `unshare --ipc` |
| `uts` | hostname, domainname | `unshare --uts` |
| `user` | UID/GID mappings | `unshare --user --map-root-user` |
| `cgroup` | cgroup root view | `unshare --cgroup` |
| `time` | `CLOCK_MONOTONIC`, `CLOCK_BOOTTIME` | `unshare --time` |

The `demo-02-unshare.sh` script does two of these. First, the **user namespace**:

```bash
$ unshare --map-root-user --user /bin/bash
# inside the new namespace:
$ whoami
root
$ id -u
0
$ rm -f /boot/vmlinuz-*           # this should be catastrophic
# (it silently does nothing, we are not actually root)
$ cat /etc/shadow
cat: /etc/shadow: Permission denied
$ cat /proc/self/uid_map
         0       1000          1
```

That `uid_map` line is the punchline: **UID 0 in this namespace is mapped to UID 1000 (the host vagrant user) in the kernel.** So inside the namespace, `whoami` reports `root`, but every syscall the kernel evaluates is still being made as UID 1000. The host's `/etc/shadow` (mode 0640, owned by root:shadow) refuses you.

This is exactly how rootless containers work. The container can have its own root user without giving the host away.

Then the **PID namespace**:

```bash
$ ls -al /proc/self/ns/pid
lrwxrwxrwx 1 root root 0 ... /proc/self/ns/pid -> 'pid:[4026531836]'
$ sudo unshare --pid --fork --mount-proc /bin/bash
# inside the new PID namespace:
$ ls -al /proc/self/ns/pid
lrwxrwxrwx 1 root root 0 ... /proc/self/ns/pid -> 'pid:[4026532471]'   # different number!
$ ps -ef
UID  PID  PPID  C  STIME  TTY  TIME      CMD
root 1    0     0  10:42  pts  00:00:00  /bin/bash
root 5    1     0  10:42  pts  00:00:00  ps -ef
```

The shell that opened this namespace is now PID 1. There is nothing else visible. **This is what Docker does for every container.** The reason a container's main process is special, and why signal handling and zombie reaping become your responsibility (`tini`, `dumb-init`), is because the entrypoint inherits PID 1 inside the container's PID namespace.

---

## cgroups: how much can I have?

Namespaces answer "what can I see?" Cgroups answer "**how much can I have?**" CPU, memory, IO bandwidth, the number of processes you can fork, all of it.

`demo-03-cgroup_v2.sh` starts three `dd if=/dev/zero of=/dev/null bs=1M &` processes (each will saturate one core), then puts two of them into a new cgroup with a CPU quota:

```bash
sudo mkdir /sys/fs/cgroup/mydemocpugroup
cd /sys/fs/cgroup/mydemocpugroup

# move two of the dd processes under this cgroup's control
for pid in $(pidof dd | head -2); do
  echo $pid | sudo tee cgroup.procs
done

# limit those two to 50% of one CPU (50000 µs of every 100000 µs)
echo "50000 100000" > cpu.max
```

Watch `top` in another terminal: the two PIDs in the cgroup drop to ~25% each (sharing 50%). The third `dd`, untouched by the cgroup, stays pinned to 100% of its core.

This is **the** mechanism behind `resources.limits.cpu` and `resources.limits.memory` in a Pod spec:

```yaml
resources:
  requests:
    memory: 800Mi
  limits:
    memory: 1Gi
```

`requests` is the floor the scheduler uses to decide *which node fits this pod*. `limits` is the cap kubelet writes into the cgroup file at `/sys/fs/cgroup/.../memory.max`. When the process exceeds the memory limit, the kernel OOM-kills it. When it exceeds the CPU limit, it gets throttled. Same primitive, two outcomes.

---

## Capabilities: what is `root` allowed to do?

In classic Unix, the answer to "what can root do?" was: everything. Linux capabilities split that monolithic privilege into ~40 distinct powers (`man capabilities`). A few from the list:

- `CAP_NET_BIND_SERVICE`, bind to ports below 1024
- `CAP_NET_ADMIN`, change routing tables, configure interfaces
- `CAP_SYS_ADMIN`, change hostname, mount filesystems, the kitchen sink
- `CAP_SYS_TIME`, set the system clock
- `CAP_SETUID`, change UID

Docker drops most of them by default. `demo-04-capabilities.sh` shows it:

```bash
docker run -it ubuntu:jammy bash
# inside:
hostname kuala-lumpur
hostname: you must be root to change the host name   # we ARE root, but...
exit

docker run -it --cap-add=SYS_ADMIN ubuntu:jammy bash
# inside:
hostname kuala-lumpur
hostname                # works now!
```

Same image, same UID 0, different capability set → different powers. **This is the model Kubernetes inherits.** The pod-level security context is where you grant or drop capabilities:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]   # only if you need to bind to a low port
```

The `kube-terminator` Helm chart we deployed at the end of the training uses exactly this:

```yaml
securityContext:
  runAsUser: 1001
  runAsNonRoot: true
  runAsGroup: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
```

The principle is **least privilege**: a Pod should not have capabilities it does not need. If your container is a stateless web server, it does not need `CAP_SYS_ADMIN`.

---

## seccomp: which syscalls can I make?

Capabilities operate on what root can do. `seccomp` operates one level deeper: **which syscalls can this process make at all**, regardless of who is running it.

A seccomp profile is a list of allowed (or blocked) syscalls and an action for the rest, usually `EPERM` (return permission denied) or `SCMP_ACT_KILL` (terminate the process). Docker's default seccomp profile blocks ~44 syscalls including `keyctl`, `kexec_load`, `mount` (without `CAP_SYS_ADMIN`), and a long tail of obscure ones used in container-escape exploits.

Kubernetes 1.19+ supports seccomp profiles natively in the pod spec:

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault   # or Localhost with localhostProfile: my-profile.json
```

You will rarely write a custom profile. But knowing it exists is what unblocks reading container security advisories and CVE descriptions.

---

## overlayfs: the secret behind image layers

The last conceptual piece is how Docker images store data efficiently. The answer is `overlayfs`, a copy-on-write filesystem.

```bash
mkdir lower upper merged work
echo "from lower" > lower/file_a
echo "from upper" > upper/file_b

sudo mount -t overlay overlay \
  -o lowerdir=lower,upperdir=upper,workdir=work \
  merged

ls merged          # file_a, file_b
cat merged/file_a  # "from lower"
echo "modified" > merged/file_a
ls upper           # file_a is now also in upper, copy-on-write
cat lower/file_a   # still "from lower", the lower layer was never touched
```

That is **exactly** how a Docker image works. Each instruction in your Dockerfile (`COPY`, `RUN`, `ADD`) creates a new lower-layer directory. When you start a container, the engine adds a writable upper layer on top. Writes go into the upper. Reads fall through layer by layer until something is found. **That is why `docker pull` is fast for layers you already have**, they are shared by reference, not copied.

This is also why the rule **"put rarely-changing layers earlier in your Dockerfile"** matters. Every layer below the change has to be re-pulled if its hash changes. Drop a `COPY . /app` near the top and you bust the cache for everything below it on every commit.

---

## Putting it together: a container is a process

Stack the pieces and you have built a container by hand:

```
1. unshare(CLONE_NEWNS|NEWPID|NEWNET|NEWUTS|NEWIPC|NEWUSER|NEWCGROUP)
2. mount -t overlay (lower=image-layers, upper=writable, merged=container-rootfs)
3. chroot into the merged rootfs
4. write /sys/fs/cgroup/<id>/{cpu.max, memory.max, ...}
5. apply seccomp profile
6. drop all capabilities except the allowed set
7. setuid to runAsUser
8. exec your entrypoint
```

That sequence is, in essence, what `runc` does. Docker (containerd) is a higher-level wrapper that adds image management, networking and the daemon. Kubernetes is yet another wrapper that schedules many of these across many nodes.

If you understand the eight steps above, you understand what is happening when you run `kubectl apply -f pod.yaml`. The kubelet on the chosen node walks down the same primitives.

![The full container stack, registry, image store, Docker (buildKit / containerD / runC), the read-only image layers + writable delta, and the Linux kernel primitives (chroot, namespaces, cgroups, overlayFS, seccomp) at the bottom](/images/blog/k8s/container-stack.jpg)

> **Hendrik (the trainer) put it well in class:** *"With great power comes great responsibility."* Once you know which knobs exist, `securityContext.capabilities`, `seccompProfile`, `runAsNonRoot`, `readOnlyRootFilesystem`, you have an obligation to set them. The default of "container runs as root with all capabilities" is a security incident waiting to happen.

Next post: how Docker turns these primitives into something developer-friendly, and why your multi-stage Dockerfile matters more than you think.

→ [Part 2: Docker & Dockerfiles](/blog/k8s-2-docker-and-dockerfiles)

---

## Resources

- [`man 7 namespaces`](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [`man 7 capabilities`](https://man7.org/linux/man-pages/man7/capabilities.7.html)
- [Cgroups v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [overlayfs kernel docs](https://docs.kernel.org/filesystems/overlayfs.html)
- [The training's `container-demos/` README](https://github.tools.sap/kubernetes/docker-k8s-training/tree/master/container-demos) (SAP-internal)
