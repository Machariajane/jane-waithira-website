## Introduction

Once you have Pods, Deployments, Services and Ingress (parts [3](/blog/k8s-3-pods-deployments-services) and [4](/blog/k8s-4-storage-configmaps-ingress)), you have everything needed to run a stateless web application. Real systems are not all stateless and not all open. They include:

- **Databases and message brokers** that need stable identities and per-replica disks → `StatefulSet`.
- **Multiple users with different permissions** on the same cluster → RBAC, ServiceAccounts.
- **Resource budgets** so one team's runaway job does not starve another's → ResourceQuota, LimitRange, HPA, VPA.
- **Network segmentation** so the database is not reachable from anywhere, only from the app → `NetworkPolicy`.

This post covers the four. They are the difference between a demo and something a security review will sign off on.

![Day-5 recap drawing: the API server with all the resource types (Deployment, Pod, Service, ConfigMap, Secret, ServiceAccount, Role, RoleBinding, NetworkPolicy, StatefulSet, Ingress); a StatefulSet on the left (`Pod-0` with its own disk, ordinal index); a NetPol filtering ingress/egress between Pods on different nodes; and an Ingress controller that registers a domain and reads all Ingress resources to forward HTTP based on hostname](/images/blog/k8s/rbac-statefulset-netpol.jpg)

---

## Table of Contents

1. [StatefulSets: when "any pod will do" is not okay](#statefulsets-when-any-pod-will-do-is-not-okay)
2. [Headless services and stable DNS](#headless-services-and-stable-dns)
3. [The pod identity model](#the-pod-identity-model)
4. [ServiceAccounts and RBAC](#serviceaccounts-and-rbac)
5. [Resource requests, limits, quotas](#resource-requests-limits-quotas)
6. [HPA vs VPA](#hpa-vs-vpa)
7. [NetworkPolicy: the deny-by-default mindset](#networkpolicy-the-deny-by-default-mindset)
8. [Egress: the often-forgotten direction](#egress-the-often-forgotten-direction)

---

## StatefulSets: when "any pod will do" is not okay

A `Deployment` assumes the pods it manages are **fungible**: any pod can be killed and replaced because the next pod can step in instantly. That works for a stateless web server. It breaks the moment you have:

- A primary/replica database where one pod is the leader.
- A cluster member that needs a stable network identity (Cassandra, Kafka, Elasticsearch).
- A pod that owns a specific disk that cannot be moved.

`StatefulSet` is the controller for those cases. Compared to a Deployment, it changes four things:

| Concern | Deployment | StatefulSet |
|---|---|---|
| Pod names | `nginx-7d4f-x9k2l` (random) | `web-0`, `web-1`, `web-2` (ordinal) |
| Creation order | parallel | strict ordinal: 0 first, then 1, then 2 |
| Deletion order | parallel | reverse ordinal: 2 first, then 1, then 0 |
| Storage | shared or none | one PVC per pod, via `volumeClaimTemplates` |
| DNS | only via the Service | each pod gets `<name>.<service>.<ns>.svc.cluster.local` |

The skeleton from the exercise:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: nginx                     # the headless service (see below)
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      initContainers:
      - name: setup
        image: alpine:3.22
        command: ["/bin/sh", "-c", "echo $(hostname) >> /work-dir/index.html"]
        volumeMounts:
        - name: web-pvc
          mountPath: /work-dir
      containers:
      - name: nginx
        image: nginx:mainline
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: web-pvc
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: web-pvc
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

Apply it. `kubectl get pods -w`:

```
web-0   0/1   ContainerCreating   0   0s
web-0   1/1   Running             0   8s
web-1   0/1   Pending             0   0s          # waits for web-0
web-1   0/1   ContainerCreating   0   2s
web-1   1/1   Running             0   10s
```

The ordered creation matters because in real stateful systems, **pod 0 might be doing something pod 1 needs first**, initialising a cluster, claiming the leader role, seeding the schema.

`volumeClaimTemplates` is the killer feature. The StatefulSet creates a *separate PVC for each pod* (`web-pvc-web-0`, `web-pvc-web-1`, …). Each pod gets its own disk. When `web-0` is deleted, it is recreated as `web-0` and reattaches the same `web-pvc-web-0`. Stable name, stable disk.

> **Trainer's mental model** (Hendrik): *"Deployment = for stateless apps, Pods don't get stable hostnames. StatefulSet = stable hostnames, predictable scaling, add storage template and generate individual disks per replica."* And the meta-rule: *"Write the Pod spec first, then ask what qualities you need, then pick the right workload controller (Deployment, StatefulSet, DaemonSet, Job, CronJob)."*

---

## Headless services and stable DNS

A regular `Service` gives you one virtual IP that load-balances across all matching pods. For a StatefulSet, that is wrong, you want to be able to address `web-0` and `web-1` *individually*, by name. The answer is a **headless service**: `clusterIP: None`.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  clusterIP: None       # <- this makes it headless
  selector:
    app: nginx
  ports:
  - port: 80
    name: web
```

With this in place, cluster DNS gives you:

- `nginx.<namespace>.svc.cluster.local`, round-robin across all matching pods (no virtual IP, just A records for the pod IPs).
- `web-0.nginx.<namespace>.svc.cluster.local`, the IP of pod `web-0`.
- `web-1.nginx.<namespace>.svc.cluster.local`, the IP of pod `web-1`.

Test from a temporary helper pod:

```bash
$ kubectl run dns-test -i --tty --restart=Never --rm \
    --image alpine:3.22 -- sh
/ # nslookup nginx
/ # nslookup web-0.nginx
/ # curl web-0.nginx
web-0
/ # curl web-1.nginx
web-1
```

The two pods serve different `index.html` files because each one has its own disk and the `initContainer` wrote its own hostname there. **Stable identity = the right pod always sees the right data.**

---

## The pod identity model

Inside every pod, kubelet mounts a few files at well-known paths so the pod can introspect:

```
/etc/resolv.conf                              # cluster DNS (CoreDNS) + search domains
/var/run/secrets/kubernetes.io/serviceaccount/token   # JWT for talking to the API
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt  # the API server's CA
/var/run/secrets/kubernetes.io/serviceaccount/namespace
```

```bash
$ cat /etc/resolv.conf
search part-0023.svc.cluster.local svc.cluster.local cluster.local <upstream-domains>
nameserver 100.104.0.10
options ndots:5
```

The `search` domains are the magic behind "I just typed `nginx` and it resolved". With `ndots:5`, any name with fewer than 5 dots gets the search list appended. So `nginx` → `nginx.part-0023.svc.cluster.local`, `nginx.other-ns` → `nginx.other-ns.svc.cluster.local`, etc.

> **Class moment** from the trainer: *"There's also `node-local-dns`, a cache on each node to avoid querying CoreDNS too often, plus a fast path for queries that go upstream."* If your cluster has it, queries that miss the cache go to CoreDNS; queries that match the upstream zone bypass CoreDNS entirely.

The serviceaccount token is what identifies the pod when it talks to the API server, which is the bridge to RBAC.

---

## ServiceAccounts and RBAC

Every Pod runs as some **ServiceAccount**. If you do not specify one, it is `default`. The ServiceAccount has a JWT token mounted at the path above. When the pod calls `kubectl` (or any client library) with no other auth, that token is what travels in the `Authorization: Bearer ...` header.

The ServiceAccount itself does nothing, it is just an identity. **Permissions** come from `Role` (namespaced) or `ClusterRole` (cluster-wide), bound to the ServiceAccount via `RoleBinding` or `ClusterRoleBinding`.

A minimum-viable example: let a pod list pods in its own namespace.

```yaml
# 1. ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-watcher

# 2. Role: what the SA may do
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

# 3. RoleBinding: connect the SA to the Role
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-watcher-can-read-pods
subjects:
- kind: ServiceAccount
  name: pod-watcher
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io

# 4. Use it in a Pod
---
spec:
  serviceAccountName: pod-watcher
  ...
```

Two introspection commands that are worth their weight:

```bash
$ kubectl auth whoami
ATTRIBUTE   VALUE
Username    i530939@global.corp.sap
Groups      [system:authenticated]

$ kubectl auth can-i --list
Resources                  Verbs
configmaps                 [get list watch create update delete]
pods                       [get list watch]
deployments.apps           [get list watch]
*.metrics.k8s.io           [get list]
selfsubjectaccessreviews.* [create]
...
```

> *"Small spoiler"*, Hendrik in class, *"try `kubectl auth whoami` to know your username/group, and `kubectl auth can-i --list` to learn what you are allowed to do."* This is the first thing I run on any new cluster.

The kube-terminator chart we deployed in the Helm exercise asked for very high privileges:

```yaml
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: admin            # ← cluster-wide admin
subjects:
  - kind: ServiceAccount
    name: kube-terminator
    namespace: part-0023
```

That makes sense, the terminator's job is to delete pods, anywhere. But it is also why you read every chart's `templates/rbac.yaml` before installing it: a chart can grant itself far more than it actually needs.

---

## Resource requests, limits, quotas

A Pod without `resources` is a Pod that the scheduler treats as zero-cost, you can pack the cluster until it falls over. **Always set requests and limits.**

```yaml
resources:
  requests:
    cpu: 100m            # 0.1 of one core, scheduling floor
    memory: 800Mi        # scheduling floor
  limits:
    cpu: 500m            # cgroup throttling cap
    memory: 1Gi          # OOM-kill threshold
```

The four behaviours you should internalise:

| Resource | At request | At limit |
|---|---|---|
| `cpu` | scheduler reserves this much; pod can burst above | cgroup throttles, pod gets slow but does not die |
| `memory` | scheduler reserves this much | kernel OOM-kills the container; kubelet restarts it |

Above the pod, three cluster-side guardrails:

- **`ResourceQuota`**, cap the total resources a namespace can request (e.g. "namespace `team-a` may not request more than 100 CPUs and 200Gi memory").
- **`LimitRange`**, set defaults and minimums for any pod created without explicit `resources` (e.g. "every container without a `limits.memory` gets `1Gi` automatically").
- **`PriorityClass`**, when the cluster is full, which pods get evicted first?

The training cluster had a default `LimitRange` of `500Mi` per container. The Spring Boot fortune-cookies app needed `800Mi`/`1Gi` to start without being OOM-killed during JVM warmup, so we had to set `requests` and `limits` explicitly in its Deployment.

---

## HPA vs VPA

Two scaling axes, often confused:

| Autoscaler | Changes | Best for |
|---|---|---|
| **HorizontalPodAutoscaler** (HPA) | the *number* of replicas | stateless services where you can split load across more pods |
| **VerticalPodAutoscaler** (VPA) | the *size* of each pod (requests/limits) | stateful services that need bigger pods, not more pods |

The trainer's one-line summary in class: *"HPA = ReplicaCounts, VPA = ResourceCounts."*

HPA out of the box scales on **average CPU utilization** (or memory, or any custom metric you wire up via the metrics adapter):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

You almost always want HPA + sensible requests + a `PodDisruptionBudget`. VPA is the right answer when the application **does not parallelize well** (a JVM that needs a 4Gi heap, a Postgres primary).

---

## NetworkPolicy: the deny-by-default mindset

By default, in a Kubernetes cluster, **every pod can talk to every other pod, in any namespace, on any port**. This is fine for a sandbox; it is unacceptable for production. `NetworkPolicy` is how you fix it.

A NetworkPolicy has two halves:

```yaml
spec:
  podSelector:        # which pods does this policy apply to?
    matchLabels:
      app: nginx
  policyTypes:
  - Ingress           # filter incoming traffic
  - Egress            # filter outgoing traffic
  ingress:
  - from:
    - podSelector:
        matchLabels:
          access: "true"
  egress: []          # explicitly: no egress allowed
```

Read it as: *"For pods labeled `app=nginx`, only allow incoming traffic from pods labeled `access=true` (in the same namespace), and allow no outgoing traffic at all."*

Important rules of NetworkPolicy semantics:

1. **Empty `ingress: []` means deny all incoming.** Empty `from: []` inside a rule means allow from anywhere, these look similar and behave opposite.
2. **NetworkPolicies are additive.** Two policies that target the same pod combine via OR, if either one allows the traffic, it is allowed.
3. **A pod with no policy targeting it is unrestricted.** As soon as one policy targets it, *only* what is explicitly allowed gets through.
4. **Network policies need a CNI plugin that supports them** (Calico, Cilium, Antrea, all do; some flat-network setups do not).
5. **Policies match pods, not Services.** Traffic from a Service targets a pod IP, so the policy on the destination pod is what counts.

The exercise was a clean illustration:

```bash
# Step 0: create a tester pod, confirm it can reach the nginx service
$ kubectl run tester -i --tty --restart=Never --rm \
    --image=alpine:3.22 -- ash
/ # wget --timeout=1 -q -O - nginx
Connecting to nginx (10.7.249.39:80)
<!DOCTYPE html>...                    # success

# Step 1: apply a policy that only allows pods with label access=true
# Step 2: from the same tester pod (which has no such label):
/ # wget --timeout=1 -q -O - nginx
wget: download timed out

# Step 3: re-launch the tester WITH the label
$ kubectl run tester --labels="access=true" \
    -i --tty --restart=Never --rm \
    --image=alpine:3.22 -- ash
/ # wget --timeout=1 -q -O - nginx
<!DOCTYPE html>...                    # works again
```

In the capstone fortune-cookies app, two NetworkPolicies do most of the heavy lifting:

1. **`db-access`**, the Postgres pod accepts incoming traffic only from `module=app` pods. It explicitly denies all egress (a database does not need to call the internet).
2. **`app-access`**, the Java app accepts incoming traffic only from the `ingress-nginx` controller (pods in the `kube-system` namespace with specific labels), and its egress is restricted to Postgres + DNS.

---

## Egress: the often-forgotten direction

Most teams write `Ingress` rules first and forget egress entirely. The training emphasised this, egress restriction is what stops a compromised app pod from reaching the internet to call its C2 server, or from talking to your database without authorization.

DNS is the recurring gotcha. If you `egress: []` on a pod, you also block DNS lookups, and the app errors out with weird name resolution failures. The standard exemption:

```yaml
egress:
# allow DNS
- to:
  - namespaceSelector:
      matchLabels:
        gardener.cloud/purpose: kube-system
    podSelector:
      matchLabels:
        k8s-app: kube-dns
  ports:
  - protocol: UDP
    port: 8053
  - protocol: TCP
    port: 8053

# allow node-local-dns (runs in host network, hence ipBlock)
- to:
  - namespaceSelector:
      matchLabels:
        gardener.cloud/purpose: kube-system
    podSelector:
      matchLabels:
        k8s-app: node-local-dns
  - ipBlock:
      cidr: 0.0.0.0/0
  ports:
  - protocol: UDP
    port: 53
  - protocol: TCP
    port: 53

# only THEN add the actual app egress, like the database
- to:
  - podSelector:
      matchLabels:
        component: fortune-cookies
        module: db
  ports:
  - protocol: TCP
    port: 5432
```

You can verify lockdown from inside the pod:

```bash
kubectl exec -it postgres-0 -- ash
# inside:
apk update         # times out, egress to package mirrors is denied ✅
wget google.de     # times out, egress to internet is denied ✅
```

> **Class moment** when this clicked. Adam T. asked: *"Could you spawn a DaemonSet using the new image, setting the command to a no-op and give it minimal resource requests, to effectively pull the image on all nodes?"* The trainer noted Gardener has a [registry cache extension](https://gardener.cloud/docs/) that does this automatically. The point: NetworkPolicy and image-pulling interact, if your nodes cannot reach the registry, your pods cannot start, no matter how clean your YAML is.

---

That covers the security and isolation knobs. The last piece, and the one that ties it all together, is Helm: how do you ship a *bundle* of all of the above (Deployment + Service + ConfigMap + NetworkPolicy + Ingress + RBAC) as one versioned artefact?

→ [Part 6: Helm & The Fortune-Cookies Capstone](/blog/k8s-6-helm-and-fortune-cookies)

---

## Resources

- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) and [ServiceAccount tokens](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
- [Resource management for pods and containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Resource quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [HorizontalPodAutoscaler walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [`kubectl auth can-i`](https://kubernetes.io/docs/reference/access-authn-authz/authorization/#checking-api-access)
