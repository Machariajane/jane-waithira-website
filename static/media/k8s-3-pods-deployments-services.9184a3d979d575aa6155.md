## Introduction

After two days of Docker, day three opened with the question: **how do I run many of these containers, on multiple machines, with restart-on-failure, rolling updates, and a stable address other services can talk to?** That is the problem Kubernetes solves, and the first three exercises map exactly onto its three foundational abstractions:

1. **Pod**, one or more containers scheduled together on a node.
2. **Deployment**, a controller that keeps `N` Pods alive and rolls out new versions.
3. **Service**, a stable virtual IP / DNS name that load-balances across a set of Pods.

This post walks through all three, plus the `kubectl` mental model that ties them together. Where the class hit a confusing edge, I quote it from the Teams chat, those moments turn out to be exactly the spots where the documentation does not save you.

![Kubernetes high-level overview: how the core concepts relate](/images/blog/k8s/K8S_HL_Overview.png)

---

## Table of Contents

1. [The kubectl mental model](#the-kubectl-mental-model)
2. [Pods: the smallest deployable unit](#pods-the-smallest-deployable-unit)
3. [Liveness, readiness, startup probes](#liveness-readiness-startup-probes)
4. [Deployments: ReplicaSets, scaling, rolling updates](#deployments-replicasets-scaling-rolling-updates)
5. [Rolling update, rollback, and the maxUnavailable knob](#rolling-update-rollback-and-the-maxunavailable-knob)
6. [Labels and selectors: how everything finds everything else](#labels-and-selectors-how-everything-finds-everything-else)
7. [Services: ClusterIP, NodePort, LoadBalancer](#services-clusterip-nodeport-loadbalancer)
8. [The "no Endpoints" debugging recipe](#the-no-endpoints-debugging-recipe)

---

## The kubectl mental model

Almost every `kubectl` command follows the same shape:

```
kubectl <verb> <resource> [<name>] [-n <namespace>] [-o <format>] [-l <selector>]
```

![Kubernetes architecture: a user types `kubectl <verb> <resource>`, the API server validates and persists the desired state to etcd, the scheduler + controller-manager observe / analyze / act, and kubelet on the right node turns the resource into a running Pod via the container runtime](/images/blog/k8s/control-plane-architecture.jpg)

| Verb | What it does |
|---|---|
| `get` | List resources. `-o yaml` / `-o json` for the full object, `-o wide` for extra columns. |
| `describe` | Human-readable summary including events. **First place to look when something is wrong.** |
| `create` | Create from a flag (`kubectl create deployment ...`). Imperative. |
| `apply -f` | Create-or-update from a YAML file. Declarative, what you want CI/CD to do. |
| `delete` | Remove resource. `--cascade=foreground` to wait for children. |
| `logs` | Stream a container's stdout/stderr. `-f` to follow, `--previous` for the last crashed container. |
| `exec -it <pod> -- <cmd>` | Run a command inside a pod. `-- bash` for an interactive shell. |
| `edit` | Open the live resource in `$EDITOR`. Drift-prone, prefer `apply`. |
| `diff -f` | Show what `apply -f file.yaml` *would* change. Use this before any prod-touching apply. |
| `port-forward` | Tunnel a local port to a pod or service. Great for debugging. |
| `auth can-i --list` | What am I allowed to do in this namespace? |
| `auth whoami` | Who does the API server think I am? |

A handful of habits that pay back daily:

- `kubectl explain pod.spec.containers.livenessProbe`, instead of context-switching to the docs, ask kubectl. It knows the schema.
- `kubectl get pods -l app=nginx -o wide`, the `-l` selector is your zoom tool.
- `kubectl get all -n my-namespace`, get every "common" resource in one shot. (Not literally all, see the alias trick below.)
- `alias kga='kubectl api-resources --verbs=list --namespaced -o name | xargs -I {} kubectl get {} --ignore-not-found'`, when you really want everything in the namespace, including ConfigMaps, Secrets, Ingresses, NetworkPolicies. (This alias was shared in our class Teams chat by Marc V. and immediately became my favourite.)

> **Class moment.** A participant ran `kubectl get nodes` and got `connection refused`. The trainer's first question: *"Is your `KUBECONFIG` env var pointing at the right file?"* Kubectl reads `$KUBECONFIG`, falls back to `~/.kube/config`. When using a per-cluster config file like `part-0023.yaml`, you have to `export KUBECONFIG=part-0023.yaml` (or move it to `~/.kube/config`). Persisting the export in `~/.zshrc` saves the next ten "why does it not work?" minutes.

---

## Pods: the smallest deployable unit

A Pod is one or more containers that **share a network namespace, an IP address, and a set of volumes**, scheduled together on the same node. 99% of the time it is just one container. Multi-container pods are for tightly-coupled helpers: a sidecar that ships logs, an init container that sets up a working directory.

The smallest useful pod spec, from exercise 2:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-liveness-pod
spec:
  containers:
  - name: nginx
    image: nginx:mainline
    ports:
    - containerPort: 80
      name: http-port
    livenessProbe:
      httpGet:
        path: /
        port: http-port
      initialDelaySeconds: 3
      periodSeconds: 30
```

```bash
kubectl apply -f pod.yaml --dry-run=server   # validate without creating
kubectl apply -f pod.yaml
kubectl get pods                              # Running ✅
kubectl logs nginx-liveness-pod
kubectl exec -it nginx-liveness-pod -- bash   # poke around
kubectl delete pod nginx-liveness-pod         # gone
```

When you delete the pod, **everything goes**. The pod is ephemeral by design. There is no controller behind it making sure another pod comes up. That is the entire reason Deployments exist.

> **Why Pods, not just Containers?** Because containers in the same Pod can talk to each other on `localhost`, share a `emptyDir` volume, and live and die together. That is the right granularity for "one app + its sidecar". Anything coarser would couple unrelated apps; anything finer would force you to deal with networking between sidecars.

---

## Liveness, readiness, startup probes

The pod above has only a `livenessProbe`. There are three probe types, and they answer different questions:

| Probe | Question | What kubelet does on failure |
|---|---|---|
| `livenessProbe` | Is this container *still working*? | Kill and restart the container. |
| `readinessProbe` | Is this container *ready to serve traffic*? | Remove its IP from Service endpoints. |
| `startupProbe` | Has this container *finished starting up*? | Defer liveness checks until this passes. |

The mistake I made (and was warned about in class): **using only `livenessProbe` on a slow-starting Java app.** The liveness probe fires before Spring Boot is done initializing, returns 503, kubelet kills the container, and you get `CrashLoopBackOff` forever. The fix is either a generous `initialDelaySeconds`, a `startupProbe` that waits patiently for the first 200 OK, or, best, a real readiness probe so traffic only routes to ready pods.

Each probe supports three handler types: `httpGet`, `tcpSocket`, and `exec` (run a command, exit 0 = healthy). HTTP is the cleanest choice if your app has a `/healthz` endpoint.

---

## Deployments: ReplicaSets, scaling, rolling updates

Pods alone are fragile. A Deployment wraps them in two layers of safety net:

```
Deployment                              # the controller you write
  └─> ReplicaSet (current revision)     # ensures N pods of THIS template exist
        ├─> Pod 1
        ├─> Pod 2
        └─> Pod 3
```

The Deployment owns one or more ReplicaSets. Each ReplicaSet owns the pods for one specific pod template. When you change the pod template (e.g., new image tag), the Deployment **creates a new ReplicaSet**, scales it up, scales the old one down. That is what a rolling update actually is, two ReplicaSets, one going up, one going down.

The fastest way to a Deployment:

```bash
kubectl create deployment nginx --image=nginx:1.24
kubectl scale deployment nginx --replicas=3
kubectl get pods -l app=nginx -o wide
```

The same thing as YAML (which is what you actually want in version control):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    tier: application
spec:
  replicas: 3
  selector:
    matchLabels:
      run: nginx                  # MUST match template.metadata.labels
  template:
    metadata:
      labels:
        run: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:mainline
        ports:
        - containerPort: 80
```

A few non-obvious rules baked into that YAML:

- `selector.matchLabels` and `template.metadata.labels` must intersect, **and the selector is immutable** after the Deployment is created. Forget this and you will be `delete`-ing and re-`apply`-ing.
- `replicas: 3` is a *desired state*. The controller continuously reconciles toward it. Delete a pod by hand, a new one shows up. Kill a node, the pods on it get rescheduled elsewhere.
- The Deployment does not care which node the pods land on. The scheduler decides based on resources, taints, tolerations, affinity rules.

---

## Rolling update, rollback, and the maxUnavailable knob

```bash
# trigger an update
kubectl set image deployment/nginx nginx=nginx:mainline
# watch it
kubectl rollout status deployment/nginx
# see the history
kubectl rollout history deployment/nginx
# diff between revisions
diff <(kubectl rollout history deployment nginx --revision 1 -oyaml) \
     <(kubectl rollout history deployment nginx --revision 2 -oyaml)
# undo the last one
kubectl rollout undo deployment/nginx
# undo to a specific revision
kubectl rollout undo deployment/nginx --to-revision=1
```

The training had us deliberately ship a typo:

```bash
kubectl set image deployment/nginx nginx=nginx:mianlin   # typo
kubectl get pods
# nginx-deployment-...   0/1   ImagePullBackOff   0   30s
```

The rollout gets stuck, but **only one pod fails**, not all three. That is `maxUnavailable: 25%` (the default) at work: with 3 replicas, kubelet refuses to take more than one out of service at a time. So you have one broken pod and two still-serving pods. `kubectl rollout undo` flips the bad image back to `nginx:mainline`, the broken pod gets replaced, and traffic never noticed.

This is the single biggest reason a Deployment beats `docker run` on a single host: **failed rollouts do not take down the whole service.**

> **Class moment** (Alexander R., from the chat): *"`kubectl rollout undo deployment nginx --to-revision=1`, this way you can even choose the desired revision. Very cool."* The trainer added: *"Yes, but it is bound by `.spec.revisionHistoryLimit` of your Deployment."* Default is 10 revisions kept; older ones are garbage-collected. So `--to-revision=1` works for the first ten updates, not forever.

There is also **HPA** (HorizontalPodAutoscaler, change the replica count based on metrics) and **VPA** (VerticalPodAutoscaler, change the resource requests/limits per pod). Default HPA scales on `cpu` and `memory` average utilization. Anything fancier (queue length, custom Prometheus metric) needs the [external metrics adapter](https://github.com/kubernetes-sigs/custom-metrics-apiserver).

---

## Labels and selectors: how everything finds everything else

There are no foreign keys in Kubernetes. There are **labels** and **selectors**.

A label is a key-value pair attached to a resource:

```yaml
metadata:
  labels:
    app: nginx
    tier: frontend
    component: fortune-cookies
    module: app
```

A selector is a query against labels:

```bash
kubectl get pods -l app=nginx
kubectl get pods -l 'tier in (frontend, backend)'
kubectl get pods -l 'tier!=experimental'
```

Almost every wiring in Kubernetes is a label selector under the hood:

| Resource | Labels | Selector |
|---|---|---|
| Deployment | `template.metadata.labels` | `spec.selector.matchLabels` (which pods do I own?) |
| Service |, | `spec.selector` (which pods do I route to?) |
| NetworkPolicy |, | `spec.podSelector` (which pods do I apply to?), `spec.ingress.from.podSelector` (which pods are allowed?) |
| Ingress |, | (indirect, points at a Service by name) |
| HPA |, | `spec.scaleTargetRef` (which Deployment do I scale?) |

The capstone exercise nailed this with a two-level convention:

- `component: fortune-cookies`, separates *this app* from everything else in the namespace.
- `module: app` or `module: db`, separates the frontend from the database within the app.

That gives you queries like `kubectl get all -l component=fortune-cookies` (everything for this app) or `kubectl get pvc,sts -l module=db` (just the database side). Pick a convention early; refactoring labels later is painful.

---

## Services: ClusterIP, NodePort, LoadBalancer

A Service is **a stable virtual IP and DNS name in front of a set of Pods**, with built-in load balancing. The Pods can come and go (rolling updates, node failures); the Service IP stays the same.

There are three types, in order of "how much exposure":

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  type: ClusterIP        # default, only reachable inside the cluster
  selector:
    app: nginx
  ports:
  - port: 80             # the Service's port
    targetPort: 80       # the Pod's port (the named port http-port also works)
```

| Type | Reachable from | Provided by | Use when |
|---|---|---|---|
| `ClusterIP` (default) | inside the cluster only | the cluster's kube-proxy | service-to-service traffic; the safe default. |
| `NodePort` | every node's IP, on a port in the 30000-32767 range | kube-proxy plus a port allocation | quick external testing without a cloud LB. |
| `LoadBalancer` | a public IP your cloud provider hands out | the cloud's load balancer integration (OpenStack, AWS, GCP, …) | actual external exposure. |
| `ExternalName` | DNS CNAME to an external host | CoreDNS | aliasing an external service inside cluster DNS. |

Inside the cluster, every Service is also a DNS name: `<service>.<namespace>.svc.cluster.local`. From a pod in the same namespace, `nginx` is enough. From another namespace, `nginx.other-ns`.

![A `ClusterIP` Service: the Service's name (`my-service`, selector `app: nginx`) becomes a DNS-resolvable virtual IP (`100.105.96.4`) that kube-proxy load-balances to matching Pods on different nodes, `100.64.1.15` and `100.64.3.18`, regardless of which node the caller sits on](/images/blog/k8s/service-clusterip.jpg)

A real example from class. The Service was created via `expose`:

```bash
kubectl expose deployment nginx --type=LoadBalancer --port=80 --target-port=80
kubectl get svc
# NAME    TYPE          CLUSTER-IP        EXTERNAL-IP      PORT(S)        AGE
# nginx   LoadBalancer  100.104.210.198   157.133.161.111  80:30168/TCP   112s
```

Three IPs to keep straight:
- `100.104.210.198`, the **ClusterIP**, only routable inside the cluster.
- `157.133.161.111`, the **external IP** the cloud LB hands out. *Use this from outside.*
- `30168`, the **NodePort** auto-assigned (because every `LoadBalancer` is also a `NodePort`).

Externally you call `157.133.161.111:80`. The cloud LB forwards to a node on `:30168`, kube-proxy DNATs that to the Pod IP on `:80`, the Pod responds. From a participant during the exercise: *"Should I use 157.133.161.111:30168?"*, no, **just 157.133.161.111** (the cloud LB listens on the Service's port, not the NodePort).

![A `LoadBalancer` Service end-to-end: a public IP from the cloud-controller-manager fronts a NodePort (`31020` on every node), which kube-proxy DNATs to the Service's ClusterIP (`100.105.96.4`), which load-balances to the matching Pods. Setting `externalTrafficPolicy: Local` keeps traffic on the node that received it, preserves the client IP and avoids an extra hop.](/images/blog/k8s/service-nodeport-loadbalancer.jpg)

---

## The "no Endpoints" debugging recipe

When the IP works but the request hangs or 503s, the problem is almost always: **the Service's selector does not match any Pod.**

```bash
kubectl describe service nginx
# look for the Endpoints line:
# Endpoints:  <none>     <-- this is the bug
```

The recipe to fix it (do these in order, every time):

1. `kubectl get service nginx -o yaml | grep -A 5 selector`, what is the Service looking for?
2. `kubectl get pods -l <key>=<value> --show-labels`, does anything match?
3. If the answer is "no pods match", look at the Deployment's `template.metadata.labels` and fix one side or the other.
4. If pods match but the Endpoints list is still empty, check the readiness probe. Pods that are not Ready are not added to Endpoints.
5. If Endpoints lists IPs but you still cannot reach them, check NetworkPolicy. (See [part 5](/blog/k8s-5-statefulsets-rbac-networkpolicies).)

> **Class moment.** A participant's Service had `selector: app=exer7-pod`, but the Pod had no labels. `kubectl describe service` showed `Endpoints: ` (empty). The fix was to add `app: exer7-pod` to the Pod template. The trainer's general advice: *"Quite often the selector used within Service matches the selector specified within the deployment."* The two-level label convention (`component`, `module`) makes this nearly impossible to get wrong.

---

That covers the core triplet, Pods, Deployments, Services. Next we tackle the harder parts: **giving applications data that survives** (PersistentVolumes), **giving them configuration that varies per environment** (ConfigMaps and Secrets), and **giving them a real URL to be reached at** (Ingress).

→ [Part 4: Storage, ConfigMaps & Ingress](/blog/k8s-4-storage-configmaps-ingress)

---

## Resources

- [`kubectl` cheat sheet (k8s docs)](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Working with labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/), including [the well-known recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/)
- [HPA documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
