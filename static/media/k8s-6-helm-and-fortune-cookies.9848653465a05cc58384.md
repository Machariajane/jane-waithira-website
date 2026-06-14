## Introduction

After four days of writing raw YAML, Deployments, Services, ConfigMaps, Secrets, Ingresses, NetworkPolicies, ServiceAccounts, Roles, RoleBindings, by the time we reached **Helm** on day five, the question in the room was no longer *"is this useful?"* but *"why didn't we start with this?"*

The answer: because Helm is **a templating wrapper around Kubernetes resources**, and you cannot meaningfully template what you do not understand. The four days of YAML were not wasted, they were the prerequisite. Once you have written a `Deployment + Service + ConfigMap + Secret + NetworkPolicy + Ingress` for one app by hand, you immediately see what Helm is automating and *why*. You also see what it is hiding.

This post covers Helm itself, then the **fortune-cookies capstone**, the multi-resource Java + Postgres app that puts every concept from the series into one running system.

---

## Table of Contents

1. [What Helm is, what it isn't](#what-helm-is-what-it-isnt)
2. [The chart anatomy](#the-chart-anatomy)
3. [Install, upgrade, rollback](#install-upgrade-rollback)
4. [Values: the override hierarchy](#values-the-override-hierarchy)
5. [The kube-terminator exercise](#the-kube-terminator-exercise)
6. [The fortune-cookies capstone](#the-fortune-cookies-capstone)
7. [The three lessons that survive after the training](#the-three-lessons-that-survive-after-the-training)

---

## What Helm is, what it isn't

> **Helm is a package manager for Kubernetes.** It is `apt`/`brew`/`npm` for cluster resources., paraphrased from the trainer's slide

Three things to keep clear:

1. **Helm is *not* an installer for Kubernetes itself.** Helm runs *on* a cluster you already have, and only manipulates resources inside it.
2. **Helm is *not* magic.** Every `helm install` resolves to a YAML manifest that you could have written by hand, plus a "release record" stored in the cluster (in `Secret`s under the namespace, by default).
3. **Helm is *not* the same as zsh / oh-my-zsh / powerlevel10k.** When the class chat got confused on day five, *"is this where we were installing the zsh terminal?"*, the answer is no. Those are about your local terminal experience; Helm is about deploying applications into a cluster. They live on different layers entirely (terminal UX vs Kubernetes control plane).

The Helm vocabulary:

| Term | What it is |
|---|---|
| **Chart** | A directory or tarball that bundles a set of Kubernetes templates plus default values. The "package". |
| **Repository** | A place charts are served from, a static HTTP index, or (now more commonly) an OCI registry like Harbor. |
| **Release** | An installation of a chart into a specific namespace, with a specific name. Helm tracks this so it can upgrade, rollback or delete it. |
| **Values** | The configuration that gets merged into the chart's templates at install time. |
| **Revision** | Each `helm install` / `helm upgrade` increments the release's revision number. Old revisions stay around for rollback. |

---

## The chart anatomy

A chart is a directory with a fixed structure:

```
kube-terminator/
├── Chart.yaml         ← name, version, description, dependencies
├── values.yaml        ← default values
├── templates/         ← Kubernetes YAML, with Go template directives
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── rbac.yaml
│   ├── _helpers.tpl   ← reusable template snippets (start with _)
│   └── NOTES.txt      ← printed after install (great for usage tips)
├── README.md
└── .helmignore
```

`Chart.yaml` is the metadata:

```yaml
apiVersion: v2
name: kube-terminator
version: 0.1.0          # the chart's version
appVersion: "v1"        # the app's version (independent)
description: A controller that randomly deletes pods to test resilience
```

`values.yaml` provides the defaults:

```yaml
configuration:
  interval: 1m
  labelSelector: ""
  talkToTheHand: true     # dry-run mode

image:
  repository: harbor.example.com/library/kube-terminator
  tag: v1
  pullPolicy: IfNotPresent

rbac:
  create: true
serviceAccountName: kube-terminator
```

`templates/deployment.yaml` is *almost* a normal Kubernetes manifest, with `{{ .Values.* }}` substitutions:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/instance: {{ .Release.Name }}
    app.kubernetes.io/managed-by: Helm
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    spec:
      serviceAccountName: {{ .Values.serviceAccountName }}
      containers:
        - name: {{ .Chart.Name }}
          image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          args:
            - --namespace={{ .Release.Namespace }}
            - --dry-run={{ .Values.configuration.talkToTheHand }}
            - --interval={{ .Values.configuration.interval }}
```

When you run `helm install terminator ./kube-terminator`, Helm:

1. Reads `Chart.yaml` and `values.yaml`.
2. Merges in any `--set` flags or `-f my-values.yaml` overrides.
3. Walks the `templates/` directory, runs each file through Go's text/template engine with the merged values.
4. POSTs the resulting plain Kubernetes YAML to the API server.
5. Records the release (name, namespace, revision, manifest) in a Secret in that namespace.

The output is *just* Kubernetes resources. No daemon, no operator, no runtime dependency. **Helm leaves the building once the resources are applied.**

---

## Install, upgrade, rollback

The core commands you actually use:

```bash
# install: pulls the chart, renders templates, applies them
helm install <release-name> oci://<registry>/<repo>/<chart> --version 0.1.0

# what releases are running?
helm list -A                       # -A = all namespaces
helm status <release-name>

# render templates locally without touching the cluster, invaluable for debugging
helm template <release-name> ./my-chart -f values.yaml > rendered.yaml

# get back what was deployed (manifest + values + hooks)
helm get all <release-name>
helm get values <release-name>     # only the user-supplied values

# upgrade: same chart, new values
helm upgrade <release-name> oci://... --version 0.1.0 \
  --set "configuration.talkToTheHand=false"

# upgrade with a values file, reusing the previous values for keys not in the file
helm upgrade <release-name> oci://... --version 0.1.0 \
  -f my-values.yaml --reuse-values

# what changed across revisions?
helm history <release-name>

# go back to revision 1
helm rollback <release-name> 1

# uninstall: deletes ALL resources Helm created (and the release record)
helm uninstall <release-name>
```

`helm template` is the command I run most. It renders the chart locally, with no cluster involvement. Pipe it into `kubectl diff -f -` and you can preview every change a release will make before clicking the button. Treat any chart you cannot inspect this way as untrustworthy.

---

## Values: the override hierarchy

When you install a chart, Helm composes a final values map by merging from lowest to highest precedence:

```
1. Chart's values.yaml                  (lowest)
2. -f values.yaml                       (file)
3. -f another-values.yaml               (multiple -f flags compose left-to-right)
4. --set key=value                      (CLI literals)
5. --set-string, --set-file, --set-json (typed CLI literals)   (highest)
```

The convention I picked up from the training and have stuck with: **never edit the chart's `values.yaml`**. Always layer your overrides in a separate file in your repo. That way upgrading the chart version does not silently overwrite your config, and your cluster's actual config is in version control somewhere obvious.

```bash
# what we ran in the exercise
helm upgrade terminator oci://${INGRESS_HOSTNAME}/library/kube-terminator \
  --version 0.1.0 \
  -f terminator-values.yaml \
  --reuse-values
```

`--reuse-values` is a quirk worth knowing: by default `helm upgrade` *replaces* the user values, dropping anything you set last time. With `--reuse-values`, you keep the previous user values and only apply additions from the new `-f` and `--set`. Without it, you have to repeat *every* override every upgrade.

---

## The kube-terminator exercise

The Helm exercise installed [`kube-terminator`](https://github.tools.sap/kubernetes/docker-k8s-training), a controller that randomly deletes pods in your namespace, useful for chaos-testing resilience.

```bash
# resolve the harbor registry hostname for our Gardener training cluster
GARDENER_PROJECTNAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' | cut -d. -f3)
GARDENER_CLUSTERNAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}' | cut -d. -f2)
INGRESS_HOSTNAME=h.ingress.${GARDENER_CLUSTERNAME}.${GARDENER_PROJECTNAME}.shoot.canary.k8s-hana.ondemand.com

helm install terminator oci://${INGRESS_HOSTNAME}/library/kube-terminator --version 0.1.0
```

The pod started in dry-run mode. `kubectl logs`:

```
Startup: Using in-cluster configuration
Startup: Running terminator with interval: 1m0s, dryRun: true, labelSelector:
Terminator: Deleting Pod: web-0
Terminator: I'll be back in 1m0s
Terminator: Deleting Pod: web-0
Terminator: I'll be back in 1m0s
Terminator: Deleting Pod: terminator-kube-terminator-f77d476d6-62dtv
```

It "decided" to delete its own pod. Now flip dry-run off:

```bash
helm upgrade terminator oci://${INGRESS_HOSTNAME}/library/kube-terminator --version 0.1.0 \
  --set "configuration.talkToTheHand=false"
```

`kubectl get pods` after a minute:

```
NAME                                          READY   STATUS    RESTARTS   AGE
terminator-kube-terminator-84bdcdd66c-qkp4b   1/1     Running   0          26s   ← new!
web-0                                         1/1     Running   0          23s   ← also new!
```

The terminator deleted its own pod *and* the StatefulSet's `web-0`. Both came back. **That is the whole demo of Kubernetes self-healing in 60 seconds.** The Deployment and StatefulSet controllers reconcile against their declared desired state continuously, kill anything they own, it will be recreated.

It is also the moment where you understand why we labelled things so carefully in earlier exercises. The next step of the exercise was to constrain the terminator's blast radius:

```yaml
# terminator-values.yaml
configuration:
  labelSelector: "module=app"   # only delete pods with this label
```

```bash
helm upgrade terminator oci://... --version 0.1.0 \
  -f terminator-values.yaml --reuse-values
```

Now the chaos is scoped, only the app pods get killed, the database stays alive. Real chaos-engineering tooling (Chaos Mesh, Litmus) goes a lot further, but the core idea is exactly this: declare what you want killed, watch the system recover.

---

## The fortune-cookies capstone

The capstone project pulled the entire week together. The system: a Java/Spring Boot fortune-cookies API talking to a Postgres database, exposed externally via a TLS Ingress, locked down by NetworkPolicies. Architecturally:

```
                   Internet
                      │
                      │  HTTPS
                      ▼
        ┌────────────────────────────┐
        │  ingress-nginx (kube-system) │  ← TLS terminated here, cert from Let's Encrypt
        └──────────────┬─────────────┘
                       │  HTTP, internal
                       ▼
        ┌──────────────────────────┐
        │ Service: fortune-cookies │  type: ClusterIP, port 80 → app-port 8080
        └──────────────┬───────────┘
                       │
                       │  selector: component=fortune-cookies, module=app
                       ▼
        ┌──────────────────────────┐
        │ Deployment (2 replicas)  │  Spring Boot, configmap+secret env, imagePullSecret
        └──────────────┬───────────┘
                       │  JDBC, restricted by NetworkPolicy
                       ▼
        ┌──────────────────────────┐
        │ Service: db (headless)   │  port 5432 → db-port 5432
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ StatefulSet: postgres    │  1 replica, volumeClaimTemplate, secret env
        └──────────────────────────┘
```

The exercise built this in four steps over two afternoons:

### Step 1: Image and registry

```dockerfile
# multi-stage build, AMD64 from an M-series Mac
FROM --platform=linux/amd64 maven:sapmachine AS builder
COPY . /app
WORKDIR /app
RUN mvn verify

FROM --platform=linux/amd64 sapmachine:lts
COPY --from=builder /app/target/fortune-cookies.jar /app/
EXPOSE 8080
CMD ["java", "-jar", "/app/fortune-cookies.jar"]
```

```bash
docker buildx build --platform linux/amd64 \
  -t harbor.example.com/training/fortune-cookies-0023:0023 --load .
docker push harbor.example.com/training/fortune-cookies-0023:0023

# create the imagePullSecret so the cluster can pull from Harbor
kubectl create secret docker-registry training-registry \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password='<password>'
```

(Single quotes around the password, the trainer's note from the exercise, because the password contained a `!` that bash would otherwise expand.)

### Step 2: Database (Secret + StatefulSet + headless Service)

The labels are deliberately structured so that any kubectl query can target either everything in the app, or just the database:

```bash
# get just the database side of things
kubectl get sts,svc,pvc,secret -l module=db

# get everything for the app
kubectl get all -l component=fortune-cookies
```

`db-secret.yaml` (immutable):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  labels:
    component: fortune-cookies
    module: db
type: Opaque
immutable: true
data:
  password: <base64 of openssl rand -base64 15>
```

`db-statefulset.yaml`, Service + StatefulSet in one file (separated by `---`), reading the password via `secretKeyRef`, with a `volumeClaimTemplates` so each Postgres pod (only one here, but the pattern scales) gets its own disk.

### Step 3: Application (ConfigMap + Deployment + Service + Ingress)

`app-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-configmap
data:
  SPRING_DATASOURCE_URL: "jdbc:postgresql://db:5432/postgres"
```

`fortune-cookies.yaml`, the Deployment merges three sources of config into the container:

```yaml
spec:
  imagePullSecrets:
  - name: training-registry
  containers:
  - name: app
    image: harbor.example.com/training/fortune-cookies-0023:0023
    env:
    - name: SPRING_DATASOURCE_URL
      valueFrom:
        configMapKeyRef:
          name: app-configmap
          key: SPRING_DATASOURCE_URL
    - name: SPRING_DATASOURCE_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
    - name: SPRING_DATASOURCE_USERNAME
      value: postgres
    resources:
      requests:
        memory: 800Mi    # JVM warmup needs more than the default 500Mi
      limits:
        memory: 1Gi
```

`fortune-cookies-ingress.yaml`, the entry point, with cert-manager automatically requesting a Let's Encrypt cert via Gardener's annotation:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fortune-cookies
  annotations:
    cert.gardener.cloud/purpose: managed
spec:
  rules:
  - host: fortunes-0023.ingress.<cluster>.k8s-train.shoot.canary.k8s-hana.ondemand.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fortune-cookies
            port:
              name: http
  tls:
    - hosts:
      - fortunes-0023.ingress.<cluster>.k8s-train.shoot.canary.k8s-hana.ondemand.com
      secretName: fortunes-0023-tls       # cert-manager creates this
```

A minute or two after applying, `kubectl describe ingress fortune-cookies` shows the certificate as issued, and `https://fortunes-0023....` works in the browser with a green padlock.

### Step 4: Lock it down with NetworkPolicies

Two policies, exactly as covered in [part 5](/blog/k8s-5-statefulsets-rbac-networkpolicies):

- **`db-access`**, Postgres accepts ingress only from app pods, allows no egress.
- **`app-access`**, the Java app accepts ingress only from `ingress-nginx` in `kube-system`, and its egress is allowed to Postgres + DNS, nothing else.

Test from a temporary pod:

```bash
# without the right labels: cannot reach the DB
kubectl run helper -it --rm --image=postgres:13-alpine \
  --env="PGCONNECT_TIMEOUT=5" --command -- ash
psql -h db -p 5432 -U postgres -W postgres   # times out, expected ✅

# with module=app: works
kubectl run helper -it --rm --image=postgres:13-alpine \
  --labels="component=fortune-cookies,module=app" \
  --env="PGCONNECT_TIMEOUT=5" --command -- ash
psql -h db -p 5432 -U postgres -W postgres   # connects ✅

# from the postgres pod: cannot reach the internet
kubectl exec -it postgres-0 -- ash
apk update      # times out, egress is denied ✅
```

That's the whole stack: image build → registry → StatefulSet + Secret → Deployment + ConfigMap → Service → Ingress + TLS → NetworkPolicies. Roughly 200 lines of YAML, every line earned.

---

## The three lessons that survive after the training

A week later, my notebook came down to three rules I keep going back to:

### 1. Containers are processes; clusters are schedulers; Helm is templating

Every layer is a thin wrapper around the layer below. When something breaks, drop down: if a Pod won't start, ask what `runc` is doing; if a Pod has no Endpoints, ask what kube-proxy is configuring; if a chart misbehaves, run `helm template` and read the rendered YAML. **Do not trust the abstraction at the level of the bug.**

### 2. Label conventions are infrastructure

Pick `component` + `module` (or `app.kubernetes.io/name` + `app.kubernetes.io/component` if you want to follow the [recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/)) and use them on every resource, Deployment, Service, Ingress, NetworkPolicy, PVC, Secret. Almost every "Endpoints: <none>" / "wrong NetworkPolicy match" / "Helm upgrade missed a resource" bug comes from inconsistent labels.

### 3. Restrict by default, especially egress

Default-allow is the wrong default for production. NetworkPolicies, RBAC, securityContext (`runAsNonRoot`, `readOnlyRootFilesystem`, `drop: ["ALL"]`), seccomp profiles. The exam-style answer is "least privilege"; the practical answer is "name every interaction, deny everything else, and watch egress as carefully as ingress."

---

## And: how I actually learned this

I did not learn this from the slides. The slides set up the territory, the trainer narrated it, the exercises drilled it. **What sealed it was a side conversation**, after every single concept, with an AI study buddy. I would dump the kubectl output that confused me and ask why; or paste the YAML and ask "what is this line doing?"; or describe a behaviour and ask which primitive caused it. Some of those exchanges are quoted verbatim in this series, the "wait, why?" moments are where the actual learning happened.

That style is what every blog post in this series tries to preserve. The exercise is on the page. So is the moment where I noticed something I did not understand, and what unstuck me.

If you are heading into the same training (or any CKAD-shaped journey), start with the kernel demos. Do not skip them. Then build muscle on raw YAML for a few days, until your fingers know `apiVersion: apps/v1` from `apiVersion: networking.k8s.io/v1`. Only then reach for Helm, and you will never confuse what it does with magic again.

← Back to [the hub post](/blog/k8s-field-guide)

---

## Resources

- [Helm documentation](https://helm.sh/docs/), start with [Quickstart](https://helm.sh/docs/intro/quickstart/) and [Templating](https://helm.sh/docs/chart_template_guide/)
- [Helm best practices](https://helm.sh/docs/chart_best_practices/)
- [The Cloud Native Developer Journey (SAP)](https://pages.github.tools.sap/cloud-curriculum/materials/), the source for the fortune-cookies app
- [Gardener](https://gardener.cloud/), the managed-Kubernetes platform our training ran on
- [Kubernetes recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/)
- [The CKAD curriculum on GitHub](https://github.com/cncf/curriculum)
