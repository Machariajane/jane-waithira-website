## Introduction

Once you have seen `chroot`, namespaces, and overlayfs in action ([part 1](/blog/k8s-1-containers-under-the-hood)), Docker stops being a magic black box and starts being **a developer-friendly wrapper around primitives the Linux kernel already provides**. That reframe matters: when something breaks, you can ask "which primitive is unhappy?" instead of "what is Docker doing?".

Day one of the training, after the kernel demos, was three exercises:

1. **Exercise 1**, extend the `nginx` image to serve a custom website on port 8080.
2. **Exercise 2**, write a multi-stage Dockerfile to build a Go web app and ship only the binary.
3. **Exercise 3**, port-forward and bind-mount volumes into the running container.

This post walks through what each exercise teaches and pulls in the "wait, why?" moments I had to chase down with my AI study buddy after class.

![Docker image and container lifecycle](/images/blog/k8s/DockerLifeCycle.png)

---

## Table of Contents

1. [The build context: why Docker uploads your whole folder](#the-build-context-why-docker-uploads-your-whole-folder)
2. [Exercise 1: a custom nginx image](#exercise-1-a-custom-nginx-image)
3. [Image vs container vs layer](#image-vs-container-vs-layer)
4. [Exercise 2: multi-stage builds](#exercise-2-multi-stage-builds)
5. [Exercise 3: ports and volumes](#exercise-3-ports-and-volumes)
6. [Apple Silicon and `docker buildx`](#apple-silicon-and-docker-buildx)
7. [The Dockerfile rules I actually follow](#the-dockerfile-rules-i-actually-follow)

---

## The build context: why Docker uploads your whole folder

When you run `docker build .`, the `.` is **the build context**. Docker tars the entire directory and ships it to the daemon. The daemon then runs each `Dockerfile` instruction with that tarball as its working directory.

This catches people out. If you `docker build` from your home directory, Docker is happily tarring your `node_modules`, your `.git`, your `~/Library/Application Support`, everything, even if your Dockerfile only `COPY`s one file. The fix is `.dockerignore`, which works exactly like `.gitignore`:

```
node_modules
.git
**/*.log
.DS_Store
```

The first line of every Dockerfile is `FROM <image>`. As we saw in [part 1](/blog/k8s-1-containers-under-the-hood), the base image is the userspace your binary expects to find, libc, the dynamic linker, `/etc`, `/usr`. **`FROM scratch` is empty**: it works only for fully-static binaries (Go binaries built without cgo, Rust binaries with the musl target).

---

## Exercise 1: a custom nginx image

The first exercise extends the official nginx image to serve a custom HTML file on port 8080:

```dockerfile
FROM nginx:mainline

# copy the custom website into the image
COPY index.html /usr/share/nginx/html
COPY evil.jpg /usr/share/nginx/html

# copy the configuration file into the image
COPY docker-nginx.conf /etc/nginx/conf.d/nginx.conf

# expose the new port
EXPOSE 8080
```

```nginx
# docker-nginx.conf
server {
    listen       8080;
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
    }
}
```

Build, tag, run:

```bash
docker build -t custom-nginx:1.0 .
docker run -d -P custom-nginx:1.0
docker ps   # see which random host port maps to 8080
```

Three things to notice:

1. **`EXPOSE` is documentation.** It does not open a port. It tells anyone reading the image (and `docker run -P`) "this is the port the app listens on". The actual host-side port mapping is `-p host:container` or `-P` (publish all exposed ports to random host ports).
2. **Layers are cached by content hash.** If you change `index.html`, only the `COPY index.html ...` layer and everything below rebuilds. If you change the `FROM` line, everything rebuilds.
3. **The image is read-only.** When you `docker run`, the engine adds a writable upper layer on top. We saw this in [part 1's overlayfs demo](/blog/k8s-1-containers-under-the-hood#overlayfs-the-secret-behind-image-layers). When the container dies, the upper layer is discarded, that is why container filesystems are ephemeral.

---

## Image vs container vs layer

Easily-confused terms. Pinning them down:

| Term | What it is | Lifecycle |
|---|---|---|
| **Image** | A read-only template, a stack of overlay layers + metadata. Identified by a content hash like `sha256:abc...` and one or more tags. | Built once, pulled to many machines. |
| **Container** | A running (or stopped) instance of an image. Image + writable layer + namespaces + cgroups + a process tree. | Lives only as long as its main process. |
| **Layer** | One immutable filesystem diff. Created by `RUN`, `COPY`, `ADD`. | Shared across images by content hash, cached forever locally. |
| **Tag** | A human-readable pointer to an image hash, like `nginx:mainline` or `myapp:v1.2.3`. | Mutable, `latest` today is not `latest` tomorrow. |
| **Registry** | A server that stores images (Docker Hub, GitHub Container Registry, Harbor, ECR). | Push from build machine, pull from runtime nodes. |

![Docker layers in motion: a (remote) registry holds image manifests + layers; the local image store caches them; a running container is the immutable read-only layers + a writable delta layer; Docker is split into buildKit / containerD / runC, all sitting on top of the Linux kernel primitives](/images/blog/k8s/container-stack.jpg)

The Docker lifecycle, as drawn in the training slides:

```
Dockerfile  --build-->  Image  --tag-->  Image:tag  --push-->  Registry
                          |
                          v
                       Container  <--run--  (image)
                          |
                          +--exec--> shell
                          +--logs --> stdout/stderr
                          +--stop --> exited
                          +--rm   --> gone
```

---

## Exercise 2: multi-stage builds

Exercise 2 was the eye-opener. The task: containerize a Go HTTP echo server. Naive approach:

```dockerfile
FROM golang:1.24-alpine
WORKDIR /go/src
COPY echo-server.go go.mod ./
RUN go build echo-server.go
EXPOSE 8080
CMD ["./echo-server"]
```

That works. The image is **800+ MB**. Why? Because the `golang:1.24-alpine` base image contains the entire Go toolchain, `go build`, `gofmt`, the standard library sources, the linker. None of which you need at runtime; you only need the compiled binary.

The fix is **multi-stage builds**: have multiple `FROM` lines in one Dockerfile, then `COPY --from=` artifacts between them.

```dockerfile
# ---- build stage ----
FROM golang:1.24-alpine AS builder
COPY echo-server.go go.mod /go/src/
WORKDIR /go/src
RUN go build echo-server.go

# ---- runtime stage ----
FROM alpine:latest
LABEL maintainer="Jane Waithira"

# create an unprivileged user, never run apps as root
RUN adduser -S -D -H -h /app appuser

# pull only the compiled binary from the builder stage
COPY --from=builder /go/src/echo-server /app/

RUN chown -R appuser /app
USER appuser
WORKDIR /app

EXPOSE 8080
CMD ["/app/echo-server"]
```

Build:

```bash
$ docker build -t echo-server:1.0 .
$ docker images
REPOSITORY      TAG    IMAGE ID       SIZE
echo-server     1.0    9663ef71d178   ~12 MB
```

**800 MB → 12 MB.** Same binary, same behaviour. The build stage is discarded after `COPY --from=builder` extracts what it needs.

The pattern generalizes to every compiled language:

| Language | Builder image | Runtime image |
|---|---|---|
| Go (no cgo) | `golang:1.24-alpine` | `scratch` or `alpine:latest` |
| Rust (musl) | `rust:1-alpine` | `scratch` or `alpine:latest` |
| Java (Spring Boot) | `maven:sapmachine` | `sapmachine:lts` |
| Node.js | `node:20` | `node:20-slim` (or distroless) |
| Python | `python:3.12` (with build-essential for native deps) | `python:3.12-slim` |

The capstone project of the training, the fortune-cookies app, uses exactly this pattern with `maven:sapmachine` to build a Spring Boot jar, then `sapmachine:lts` (a JRE-only image) at runtime.

---

## Exercise 3: ports and volumes

Two operational concerns: how to talk to the container, and how to give it data that survives.

### Port forwarding

Inside the container, nginx is listening on `0.0.0.0:80`. Outside, on your laptop, port 80 is its own thing. The container's network namespace is isolated. You bridge the two with `-p`:

```bash
# explicit mapping: host port 8080 -> container port 80
docker run -d -p 8080:80 nginx:mainline

# random host port for every EXPOSEd port
docker run -d -P nginx:mainline
docker ps   # 0.0.0.0:55000->80/tcp
```

The same concept reappears in Kubernetes as `kubectl port-forward`, then `Service.type=NodePort`, then `Service.type=LoadBalancer`, different scopes, same idea.

### Bind-mounted volumes

Containers are ephemeral. To inject data from the host into the container, or to keep data when the container dies, you mount a directory:

```bash
mkdir -p ~/site
cat > ~/site/index.html <<EOF
<html><body><h1>Hello from a bind mount</h1></body></html>
EOF

docker run -d -p 8080:80 \
  --mount type=bind,source=$HOME/site,target=/usr/share/nginx/html \
  nginx:mainline
```

`--mount type=bind` overlays your host directory on top of the container's `/usr/share/nginx/html`. The container sees your `index.html`. When you edit the file on the host, the container sees the edit immediately. When the container dies, the host directory is untouched.

This is the same idea as a `hostPath` volume in Kubernetes, useful for development, never for production, because the container is now coupled to a specific host directory.

---

## Apple Silicon and `docker buildx`

If you're on an M-series Mac (M1/M2/M3/M4) and the cluster you are deploying to runs on `linux/amd64` nodes, your default `docker build` produces an `arm64` image that **the cluster cannot run**. The Pod stays in `ImagePullBackOff` or starts and immediately exits with `exec format error`.

The fix is `docker buildx`, which supports cross-platform builds via QEMU emulation:

```bash
# check what your active builder supports
docker buildx ls
# look for "linux/amd64" in the platforms column

# if not, create a dedicated builder
docker buildx create \
  --name container-builder \
  --driver docker-container \
  --use \
  --bootstrap

# build for amd64 (slower because it's emulated) and load into local docker
docker buildx build \
  --platform linux/amd64 \
  -t my-registry/my-app:v1 \
  --load \
  .

docker push my-registry/my-app:v1
```

`--platform linux/amd64,linux/arm64` builds a multi-arch manifest in one go. Push that and the cluster picks the right architecture automatically.

> This was a real footgun during the capstone exercise. From the training repo: *"If you're using M1/2/3 Mac add `--platform=linux/amd64` to the `FROM` line"*. That one-line note saves an afternoon of `CrashLoopBackOff` debugging.

---

## The Dockerfile rules I actually follow

The training drilled in a handful of habits that pay back forever:

1. **Pin your `FROM` to a tag, not `latest`.** `nginx:1.27`, not `nginx:latest`. Otherwise the image you tested on Tuesday is not the image that ships on Friday.
2. **Order layers by change frequency, low to high.** `FROM` and `RUN apt-get install` change rarely; `COPY . /app` changes every commit. Put rarely-changing layers first so the build cache survives.
3. **Use multi-stage for any compiled language.** Ship the binary, not the toolchain. Smaller image = faster pull = less attack surface.
4. **Drop to a non-root user with `USER`.** Almost no application needs to run as UID 0 inside the container. The training repo's solutions do `RUN adduser -S -D -H -h /app appuser` and `USER appuser`.
5. **Set `WORKDIR` explicitly.** Relative paths in `CMD` resolve relative to `WORKDIR`. Without it, you get surprises.
6. **`CMD ["binary", "arg1", "arg2"]` (exec form), not `CMD binary arg1`.** Exec form does not spawn a shell, so signals reach your process directly. Important for graceful shutdown in Kubernetes.
7. **Use `.dockerignore`.** Or you ship `.git/` and `node_modules/` to production.

Once a Dockerfile is doing all of the above, the next layer of concern is **the cluster**, how do I run many of these containers, networked together, with health checks and rolling updates? That is what the next post is about.

→ [Part 3: Pods, Deployments & Services](/blog/k8s-3-pods-deployments-services)

---

## Resources

- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [`docker buildx` for multi-platform images](https://docs.docker.com/build/building/multi-platform/)
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Distroless images (Google)](https://github.com/GoogleContainerTools/distroless), the next step after `alpine`
