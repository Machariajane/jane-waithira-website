## Introduction

For five days I sat in the **Docker & Kubernetes Fundamentals** training (the certified Kubernetes Application Developer track at SAP) and went from "a container is just a Linux process, wait, really?" to deploying a multi-component application with Helm charts, StatefulSets, NetworkPolicies and TLS-terminating Ingresses on a Gardener-managed cluster.

The training built up systematically, and that order matters. We did not start with `kubectl apply`. We started with `chroot`. We started with the **Linux primitives** that make a container possible at all: namespaces, cgroups, capabilities, overlay filesystems, seccomp. Only after that did Docker make sense. Only after Docker did Kubernetes make sense. And only after wrestling with raw YAML for two days did Helm feel like a relief instead of a magic black box.

This is the hub post for the series. Each section below links to a dedicated deep-dive that includes the actual exercises, the YAML I wrote, the bugs I hit, the back-and-forth from the Teams class chat, and the "why does this work?" moments I had to ask my AI study buddy after class to nail down.

> The training was hands-on: cluster access via a kubeconfig, every concept paired with an exercise, and a capstone where we shipped a Java fortune-cookies app talking to a Postgres `StatefulSet`, behind a `NetworkPolicy`, fronted by a TLS Ingress. The repo is internal (`github.tools.sap/kubernetes/docker-k8s-training`) but the curriculum mirrors the public CKAD body of knowledge closely.

---

## Why this order? (Linux → Docker → Kubernetes → Helm)

A common mistake when learning Kubernetes is to jump straight to `kubectl run` and treat everything below as a black box. That works until something breaks, and at that point the abstractions are not your friend, because you do not know what they are abstracting.

The training takes the opposite stance. The first day starts with seven shell scripts that demo the **Linux primitives** Docker is built on:

| Primitive | What it isolates | Demo in the repo |
|---|---|---|
| `chroot` | Filesystem view | `demo-01-chroot.sh`, copy `bash`, `ls`, `ps` + their libs into a directory, mount `proc`, then `chroot` in. |
| `unshare` (namespaces) | PID, user, network, mount, UTS, IPC | `demo-02-unshare.sh`, fork a bash where you "look like root" but `cat /etc/shadow` still fails. |
| `cgroups` v2 | CPU, memory, pids, IO | `demo-03-cgroup_v2.sh`, pin three `dd` processes to a CPU quota of 50% by writing to `/sys/fs/cgroup/<name>/cpu.max`. |
| Capabilities | Specific superuser powers (`CAP_SYS_ADMIN`, `CAP_NET_BIND_SERVICE`, …) | `demo-04-capabilities.sh`, change hostname inside a container only after `--cap-add=SYS_ADMIN`. |
| `seccomp` | Allowed syscalls | `demo-05-seccomp.sh`, block syscalls at the kernel boundary. |
| `overlayfs` | Layered, copy-on-write filesystem | `demo-06-overlayfs.sh`, the foundation of Docker image layers. |
| Bind mounts | Host paths into the container | `demo-07-bind-mount.sh` |

After running through those, the question that took me a whole afternoon to internalise resolves itself: **"Why can't I just put any binary in my Dockerfile? Why do I need a base image like `alpine` or `ubuntu` or `golang:1.24-alpine`?"** The answer is staring at you from `demo-01-chroot.sh`: a binary is nothing without its dynamic libraries, and a base image is just a tarball of the libs and binaries a typical program expects to find at `/lib`, `/lib64`, `/usr/bin`, etc. **A container is a process, and a process needs a userspace to live in.** That is what the base image is.

After that, Docker, Kubernetes and Helm all make a lot more sense as **layers of convenience over the same primitives**:

```
Helm                     # package manager: chart + values → set of K8s resources
  ↓
Kubernetes               # cluster scheduler: declarative API for many containers
  ↓
Docker / containerd      # container engine: turn an image into a running process
  ↓
Linux namespaces +       # the kernel's actual isolation primitives
cgroups + capabilities
  ↓
The Linux kernel         # one shared kernel, many isolated processes
```

If you skip a layer you can still do the job, but you cannot debug it.

---

## The series

### 1. [Containers Under the Hood: Linux Primitives Before Docker](/blog/k8s-1-containers-under-the-hood)

`chroot`, namespaces, cgroups, capabilities, seccomp, overlayfs. What Docker is actually doing under the hood. Why `whoami` says `root` but `cat /etc/shadow` still fails inside an unshared user namespace. Why containers share a kernel and that has security implications.

### 2. [Docker & Dockerfiles: From `FROM` to Multi-Stage Builds](/blog/k8s-2-docker-and-dockerfiles)

Image lifecycle, the build context, multi-stage builds (compile in `golang:1.24-alpine`, ship in `alpine:latest`), `EXPOSE` vs `-P` vs `-p host:container`, bind-mounted volumes, and the answer to "why does my Mac M-series build run amd64 nodes refuse my image?", `docker buildx build --platform linux/amd64`.

### 3. [Pods, Deployments & Services: The Kubernetes Mental Model](/blog/k8s-3-pods-deployments-services)

`kubectl` basics, Pods with liveness probes, Deployments that wrap ReplicaSets, label selectors, rolling updates and `rollout undo`, then Services, `ClusterIP`, `NodePort`, `LoadBalancer`, and why "no Endpoints" is almost always a label-selector typo.

### 4. [Storage, ConfigMaps & Ingress: Wiring an App Together](/blog/k8s-4-storage-configmaps-ingress)

`PersistentVolume` ↔ `PersistentVolumeClaim` ↔ `StorageClass`, the `Pod (N) → PVC (1) → PV (1) → Storage (1)` rule, `ReadWriteOnce` vs `ReadWriteOncePod` vs `ReadWriteMany`, ConfigMaps and Secrets mounted as files vs env vars, init containers, and Ingress fanout / TLS.

### 5. [StatefulSets, RBAC & Network Policies](/blog/k8s-5-statefulsets-rbac-networkpolicies)

When `Deployment` is wrong: the case for stable hostnames, `volumeClaimTemplates`, headless services and ordered rollout. Then RBAC (`kubectl auth can-i --list`, `kubectl auth whoami`), resource quotas, HPA vs VPA, and the deny-by-default mindset of `NetworkPolicy`.

### 6. [Helm & The Fortune-Cookies Capstone](/blog/k8s-6-helm-and-fortune-cookies)

Helm as `apt`-for-Kubernetes, the chart anatomy (`Chart.yaml`, `values.yaml`, `templates/`), `helm install/upgrade/rollback`, OCI registries, then the capstone: dockerizing a Java app, pushing to Harbor, deploying with a Postgres StatefulSet, locking it down with NetworkPolicies, and terminating TLS at the Ingress with cert-manager.

---

## How I learned (and why the chat transcripts matter)

I am not a "watch the lecture, take notes, move on" kind of learner. I learn by **typing the command, breaking the thing, then asking why**, and then I want one more level of "why" before I am satisfied.

So next to my terminal I kept an AI chat open. After every concept, I would dump the exercise output into the chat and ask things like:

- *"Why is my pod still in `Pending` after I scaled the deployment to 5? I have a `ReadWriteOncePod` PVC."*
- *"The terminator pod is deleting itself, then a new one comes up, what is recreating it?"* (Answer: the Deployment. That's the whole point.)
- *"My Service has an external IP but `curl` returns connection refused, what now?"* (Almost always: the label selector on the Service does not match the Pod template's labels.)
- *"Why can't I just run a `CMD` in a Dockerfile from scratch, why does it need a Linux image?"* (Because a container is a Linux process and a process needs libc, dynamic linker, `/dev`, `/proc`, … which the base image provides.)

These "small `?` moments" turned out to be where the actual learning happened, not in the slides. So in each subpage I have kept the format of: **the exercise → my output → the back-and-forth that resolved the confusion.** Where the class Teams chat had a particularly good clarification from one of the trainers (Hendrik, Marc) or a fellow participant, I quote it inline.

Pick a section above and let's dig in.

---

## Resources

- [Kubernetes API reference](https://kubernetes.io/docs/reference/kubernetes-api/)
- [Helm documentation](https://helm.sh/docs/)
- [Gardener, managed Kubernetes for everyone](https://gardener.cloud/)
- [Linux namespaces (`man 7 namespaces`)](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [The CKAD curriculum](https://github.com/cncf/curriculum)
