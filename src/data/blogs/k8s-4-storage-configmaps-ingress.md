## Introduction

Pods, Deployments and Services ([part 3](/blog/k8s-3-pods-deployments-services)) get a stateless app running and reachable. But real applications have three more concerns:

1. **Data that survives**, when a pod dies, its database files cannot die with it.
2. **Configuration that varies**, connection strings, feature flags, credentials, certificates.
3. **A real URL**, `https://my-app.example.com`, not a NodePort.

This post is the middle 30% of Kubernetes that turns "I can run a container" into "I can run a real service." Every concept here showed up in the capstone fortune-cookies app at the end of the training.

![Kubernetes traffic routing, clusters, services and pods](/images/blog/k8s/trafficDistribution.png)

---

## Table of Contents

1. [The storage chain: Pod → PVC → PV → Storage](#the-storage-chain-pod--pvc--pv--storage)
2. [Access modes: RWO, RWO-P, RWX, ROX](#access-modes-rwo-rwo-p-rwx-rox)
3. [StorageClasses and dynamic provisioning](#storageclasses-and-dynamic-provisioning)
4. [ConfigMaps and Secrets](#configmaps-and-secrets)
5. [Mounting them: env vars vs files](#mounting-them-env-vars-vs-files)
6. [Init containers: do this before the app starts](#init-containers-do-this-before-the-app-starts)
7. [Ingress: one URL in, many services out](#ingress-one-url-in-many-services-out)
8. [The 503 from the ingress is your selector](#the-503-from-the-ingress-is-your-selector)

---

## The storage chain: Pod → PVC → PV → Storage

The first thing a colleague said in our class chat that crystallized storage for me:

> *"Pod → PVC → PV → Actual storage."*, Andrzej K. (and a few corrections later) *"Pods (N) → PVC (1) → PV (1) → Storage (1)"*

That is the whole picture. Read it as a chain of indirection:

| Resource | What it is | Owned by |
|---|---|---|
| `Pod` | The thing that wants storage | You |
| `PersistentVolumeClaim` (PVC) | A request: "I want 1Gi of `default` storage class, mode `ReadWriteOnce`" | You. Lives in your namespace. |
| `PersistentVolume` (PV) | An actual disk, allocated to back a PVC | The cluster (cluster-scoped, not namespaced) |
| `StorageClass` | A template the PV provisioner uses to create PVs on demand | The cluster admin |
| Actual storage | A Cinder volume, EBS volume, NFS share, … | The cloud / storage backend |

Why three levels? **Because the dev who wants storage and the platform that provides storage are different people.** You write a PVC ("I need 5Gi"); the storage class auto-provisions a PV ("here's a Cinder volume of 5Gi") that satisfies it; the PV gets bound to your PVC; the Pod mounts the PVC.

The exercise:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nginx-pvc
spec:
  storageClassName: default
  accessModes:
    - ReadWriteOncePod
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f pvc.yaml
kubectl get pvc nginx-pvc
# NAME        STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
# nginx-pvc   Pending                                       default
```

`Pending` is normal at first. Most StorageClasses use `volumeBindingMode: WaitForFirstConsumer`, meaning the PV is not provisioned until a Pod actually wants it. Mount it from a pod and watch:

```yaml
spec:
  volumes:
  - name: content-storage
    persistentVolumeClaim:
      claimName: nginx-pvc
  containers:
  - name: nginx
    image: nginx:mainline
    volumeMounts:
    - mountPath: "/usr/share/nginx/html"
      name: content-storage
```

```bash
kubectl get pvc nginx-pvc
# NAME        STATUS   VOLUME      CAPACITY   ACCESS MODES   STORAGECLASS
# nginx-pvc   Bound    pvc-abc...  1Gi        RWOP           default
```

> **Class moment.** Liam H. asked: *"Is PVC many to one? Can you mount many PVs in one PVC?"* The trainer: *"It is always 1:1. However, a Pod may declare usage of multiple PVCs."* A Pod can have many PVCs; a PVC has exactly one PV; a PV has exactly one backing volume. Pluralism only at the top of the chain.

![Day-4 recap: storage flowing top-to-bottom (PVC declared by the Pod → StorageClass → CSI driver → actual disk), and the Service plane on the right (ClusterIP virtual IP, NodePort on every node, LoadBalancer external IP with `externalTrafficPolicy: Local` to retain client IP). RWO / RWOP / ROX / RWX access modes summarised on the left.](/images/blog/k8s/storage-and-services.jpg)

---

## Access modes: RWO, RWO-P, RWX, ROX

The single most failure-mode-rich part of Kubernetes storage. You **must** know which mode your storage class supports.

| Mode | Acronym | Pods that can mount, simultaneously |
|---|---|---|
| `ReadWriteOnce` | RWO | many pods on **one node** |
| `ReadWriteOncePod` | RWOP | exactly **one pod**, anywhere (Kubernetes 1.22+) |
| `ReadOnlyMany` | ROX | many pods, many nodes, read-only |
| `ReadWriteMany` | RWX | many pods, many nodes, read-write (rare in cloud, common in NFS) |

The training exercise made the trap explicit. The PVC was `ReadWriteOncePod`. We then bumped the Deployment's `replicas: 5`. Result:

```bash
kubectl get pods -o wide
# nginx-deployment-...   1/1   Running             1   5m   10.0.1.5    node-a
# nginx-deployment-...   0/1   ContainerCreating   0   30s              node-b
# nginx-deployment-...   0/1   ContainerCreating   0   30s              node-c
# ...
```

Only one pod ever runs. The other four are stuck in `ContainerCreating` because the volume cannot be attached to a second pod. `kubectl describe pod ...` shows the actual cause in the Events at the bottom, the kubelet refusing to mount.

**Rule of thumb:** if your application has any in-memory state per pod (a database, a caching server with persistent state), you almost certainly want `ReadWriteOnce` (or `RWOP`) and you scale via the application's clustering protocol, not by raising replicas in your Deployment. `ReadWriteMany` is fine for genuinely shared content (a CMS uploads directory, an artefact cache).

---

## StorageClasses and dynamic provisioning

A `StorageClass` is the recipe the cluster uses when someone files a PVC and there is no static PV waiting:

```bash
kubectl get storageclass
# NAME                 PROVISIONER          RECLAIMPOLICY   VOLUMEBINDINGMODE
# default (default)    cinder.csi.openstack Delete          WaitForFirstConsumer
# fast-ssd             cinder.csi.openstack Delete          WaitForFirstConsumer
```

Two important fields:

- `RECLAIMPOLICY`, what happens when the PVC is deleted. `Delete` (default) tears down the underlying volume; `Retain` keeps it for a human to clean up. **Use `Retain` for anything you cannot afford to lose.**
- `VOLUMEBINDINGMODE`, `Immediate` provisions on PVC creation; `WaitForFirstConsumer` waits until a Pod is scheduled, so the volume is created in the same zone as the Pod. The latter is almost always what you want in a multi-AZ cluster.

> **A subtle gotcha** the trainer warned about: an `RWO` PVC bound to a PV in zone A will *prevent* a Pod that needs that PVC from being scheduled to zone B. The scheduler treats it as a constraint. With `WaitForFirstConsumer` you avoid the issue because the volume gets created where the Pod lands.

---

## ConfigMaps and Secrets

A container image should be **environment-agnostic**: the same image runs in dev, staging, prod. The way you make that possible is **inject configuration at runtime**, not bake it in at build time. Kubernetes provides two resource types:

| Resource | For | Storage | Encrypted at rest? |
|---|---|---|---|
| `ConfigMap` | non-sensitive config: URLs, feature flags, log levels | base64-ish (just stored as-is) | by etcd encryption if configured |
| `Secret` | sensitive config: passwords, API keys, TLS certs | base64 *encoded* (not encrypted!) | by etcd encryption if configured + RBAC |

**Both are namespaced.** Both can be created from a literal, a file, or a directory:

```bash
# from a literal
kubectl create configmap app-config --from-literal=LOG_LEVEL=info

# from a file
kubectl create configmap nginxconf --from-file=default.conf

# Secret of type generic from a file
kubectl create secret generic nginx-basic-auth --from-file=htpasswd

# Secret of type docker-registry (used as imagePullSecrets)
kubectl create secret docker-registry training-registry \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password='<password>'   # the single quotes matter if there is an !
```

> **Class moment.** Marc V. shared *"`echo "<paste>" | base64 -d`"* in chat, because Secrets are base64-*encoded* in the YAML, not encrypted, and you want to be able to round-trip the value. The takeaway: **a Secret is not actually a secret unless your etcd is encrypted at rest and your RBAC stops other users from listing them.** Treat them with care.

---

## Mounting them: env vars vs files

Two ways to expose a ConfigMap or Secret to a container:

```yaml
# Option A: as environment variables
spec:
  containers:
  - name: app
    env:
    - name: SPRING_DATASOURCE_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
    - name: SPRING_DATASOURCE_URL
      valueFrom:
        configMapKeyRef:
          name: app-configmap
          key: SPRING_DATASOURCE_URL

# Option B: as files in a mounted volume
spec:
  volumes:
  - name: htpasswd-secret
    secret:
      secretName: nginx-basic-auth
  - name: nginxconf
    configMap:
      name: nginxconf
  containers:
  - name: nginx
    volumeMounts:
    - mountPath: /etc/nginx/auth.d
      name: htpasswd-secret
      readOnly: true
    - mountPath: /etc/nginx/conf.d
      name: nginxconf
```

When to use which:

- **Env vars**, when the app reads config from `os.environ` or `getenv`. Simpler, but: env vars are visible in `/proc/<pid>/environ`, leak into logs and crash dumps, and require a restart to change.
- **Files**, when the app reads config from disk (nginx, PostgreSQL, most JVM apps with `application.properties`). The big advantage: **the kubelet auto-syncs the mounted file when the ConfigMap or Secret changes**. No pod restart. (Caveat: it is eventually consistent, usually within ~60s.)

The TLS cert / private key combination almost always wants files. Database passwords *can* go either way; teams differ.

> **Subtle thing not in the docs.** A ConfigMap or Secret mounted as a file is a symlink. If your app `inotify`-watches the file, it gets one event per update, but if it watches the directory, it sees a flurry of `..data` symlink swap events, which can mess up reload logic. The boring fix: poll the file every minute. The fancy fix: use a sidecar that signals the app on real changes.

---

## Init containers: do this before the app starts

An `initContainer` runs to completion **before** any of the main containers start. Common uses: download a config file from object storage, run database migrations, populate an `emptyDir` volume with content.

The Ingress exercise had a small but elegant example, populate an `emptyDir` with an `index.html` containing the pod's hostname:

```yaml
spec:
  volumes:
  - name: index-html
    emptyDir: {}
  initContainers:
  - name: setup
    image: alpine:3.22
    command: ["/bin/sh", "-c", "echo $(hostname) > /work-dir/index.html"]
    volumeMounts:
    - name: index-html
      mountPath: /work-dir
  containers:
  - name: nginx
    image: nginx:mainline
    volumeMounts:
    - name: index-html
      mountPath: /usr/share/nginx/html
```

Both containers share the `emptyDir` volume. The init container writes to `/work-dir/index.html`; nginx serves from `/usr/share/nginx/html`. Same volume, different mount paths.

**Init containers are great for "before the world begins" tasks.** They are *not* great for ongoing concerns (log shipping, metrics scraping), those go in a sidecar container in the main `containers:` list.

---

## Ingress: one URL in, many services out

A Service of type `LoadBalancer` works, but it is one cloud LB per service, and there is no path-based routing, no TLS termination, no virtual hosts. **Ingress** is the layer that gives you all that with one cloud LB across many services:

```
Internet
   ↓ (1 cloud LoadBalancer)
[ Ingress Controller (nginx, Traefik, …), runs as Pods in kube-system ]
   ↓ matches host + path
[ Service A ]    [ Service B ]    [ Service C ]
   ↓                ↓                 ↓
[ Pods ]         [ Pods ]          [ Pods ]
```

There are two distinct things people both call "ingress":

| Term | What it is |
|---|---|
| `Ingress` (the resource) | A YAML object that says "host `foo.example.com`, path `/api`, backend Service `api-svc`". |
| Ingress controller | A real running thing, usually nginx or Traefik, that watches `Ingress` resources and reconfigures itself accordingly. |

![Ingress fan-out across namespaces: two namespaces (A and B) each have a `ClusterIP` Service in front of their own Pods. A single `LoadBalancer` (one public IP, e.g. `157.118.8.12`) sits in the ingress namespace. The Ingress controller routes `greenkoopa.com` to namespace A's Service and `redkoopa.com` to namespace B's Service, host-based virtual hosting on one cloud LB. Inset: the Service-type Russian-doll relationship, every `LoadBalancer` is also a `NodePort` is also a `ClusterIP`.](/images/blog/k8s/ingress-fanout-virtual-hosts.jpg)

The training cluster ran `ingress-nginx` in the `kube-system` namespace. Routing rules:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
spec:
  rules:
  - host: 0023.ingress.wdf24.k8s-train.shoot.canary.k8s-hana.ondemand.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

A few things worth knowing:

- The `host` field is matched against the HTTP `Host:` header. With multiple `host` blocks you have **virtual hosting** (host-based routing) for free.
- Multiple `paths` under the same host give you **fanout** (`/api` → service A, `/admin` → service B). For path-rewriting (`/my-app/foo` → `/foo` at the backend) you need the `nginx.ingress.kubernetes.io/rewrite-target: /$2` annotation plus `path: /my-app(/|$)(.*)` regex.
- TLS termination at the Ingress is the standard pattern. You provide a `Secret` of type `kubernetes.io/tls` and reference it from `spec.tls`. With cert-manager (or Gardener's built-in cert controller via the `cert.gardener.cloud/purpose: managed` annotation), the certificate is issued, renewed and rotated for you by Let's Encrypt.

---

## The 503 from the ingress is your selector

The single most common Ingress failure mode is also the most confusing:

```bash
$ curl 0023.ingress.wdf24.k8s-train.shoot.canary.k8s-hana.ondemand.com
<html><head><title>503 Service Temporarily Unavailable</title></head>
```

A 503 from the ingress controller (not from your app, your app has not been reached yet) almost always means **the Ingress points at a Service that has no Endpoints.**

The flow to debug:

1. `kubectl describe ingress my-app`, confirm the backend service name and port are spelled correctly.
2. `kubectl get svc my-service`, does the service even exist?
3. `kubectl describe svc my-service`, `Endpoints: <none>`? Then the **Service's selector does not match any Pod** (same recipe as in [part 3](/blog/k8s-3-pods-deployments-services#the-no-endpoints-debugging-recipe)).
4. `kubectl logs -n kube-system -l app=nginx-ingress` (or wherever your ingress controller runs), search for your hostname; the controller logs the matching attempts.
5. If the path is `/my-app` but the backend serves at `/`, you forgot the `rewrite-target` annotation.

> **Class moment.** A participant got an external IP for the Ingress but a 503 on `curl`. The trainer pinpointed it: *"You'll need to add the path as well /my-app (see `.spec.rules` in your Ingress resource)."* And from another exercise: *"`kubectl describe service exer7-service` … `Endpoints:` is empty, `app=exer7-pod` selector does not match any Pod."* Almost every Ingress 503 reduces to one of these two.

---

That covers the wiring. With storage, configuration and a real URL, your app actually works as a service. The next part dives into the cases where Deployments are not enough, when you need stable hostnames, ordered rollouts, and a deny-by-default network, i.e., StatefulSets, RBAC, and NetworkPolicies.

→ [Part 5: StatefulSets, RBAC & Network Policies](/blog/k8s-5-statefulsets-rbac-networkpolicies)

---

## Resources

- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/), the canonical doc
- [Access modes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes)
- [ConfigMaps](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Init containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) and [ingress-nginx annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/)
- [cert-manager](https://cert-manager.io/) for automatic TLS
