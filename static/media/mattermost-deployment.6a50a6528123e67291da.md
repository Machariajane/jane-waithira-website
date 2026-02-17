## Introduction

This guide walks through deploying Mattermost on Kubernetes. It covers two scenarios:

- **Scenario A:** Creating your own cluster from scratch on OpenStack
- **Scenario B:** Deploying into an existing shared cluster (most common)

Along the way we explain key concepts — Helm, Operators, registries, storage — so you understand *why* we do each step, not just *what* to do.

---

## Table of Contents

1. Key Concepts Explained
2. Prerequisites
3. Scenario A: Creating Your Own Cluster on OpenStack
4. Scenario B: Using an Existing Cluster
5. Setting Up Your Namespace
6. Storage: Persistent Volumes
7. Container Images and Registries
8. Setting Up Object Storage
9. Deploying PostgreSQL
10. Deploying Mattermost
11. Ingress, DNS and SSL
12. Configuring Mattermost
13. Making It Production-Ready
14. Troubleshooting Guide
15. Lessons Learned
16. Quick Reference

---

## Key Concepts Explained

### What is Kubernetes?

Kubernetes (K8s) is a platform for running containerized applications. Think of it as an OS for your apps: it handles scheduling (where should this run?), scaling (run more copies under load), self-healing (restart crashes), and networking.

Key terms:
- **Pod** — Smallest unit. Usually wraps one container.
- **Deployment** — Manages multiple identical pods ("run 3 copies and keep them running")
- **StatefulSet** — Like Deployment but for stateful apps (databases) needing stable names and persistent storage
- **Service** — Stable network address for a group of pods. Pods come and go; Service stays.
- **Namespace** — Virtual partition isolating your resources from other teams

---

### What is Helm?

Helm is the package manager for Kubernetes — like apt on Ubuntu or brew on Mac, but for Kubernetes apps.

Instead of writing dozens of YAML files from scratch, you use a Helm Chart: a pre-packaged, configurable collection of Kubernetes resources.

```bash
# Without Helm: write 10+ YAML files manually

# With Helm: one command
helm install my-postgres bitnami/postgresql --set auth.password=mypassword
```

Key Helm concepts:
- **Chart** — The package (like a .deb file)
- **Release** — An installed chart instance in your cluster
- **Values** — Configuration you pass to customize the chart
- **Repository** — A collection of charts hosted online (like an app store)

When to use Helm: Deploying well-known apps, managing complex multi-resource deployments, when you want easy rollbacks.

When NOT to use Helm: Some shared clusters enforce policies requiring charts to include compliance metadata. If helm install fails with a policy error, fall back to plain YAML.

---

### What is a Kubernetes Operator?

An Operator is a Kubernetes application that automates managing complex software. It knows how to run, maintain, backup, upgrade, and recover a specific app automatically.

Without an operator (PostgreSQL example):
- Deploy pod manually
- Create database and users manually
- Set up backups with cron jobs
- Handle failover manually
- Upgrade version manually

With CloudNativePG (CNPG) operator:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: my-postgres
spec:
  instances: 3
  backup:
    schedule: "0 2 * * *"   # Auto backup at 2am
```

The operator handles everything else automatically.

Operators use two building blocks:
- **CRDs (Custom Resource Definitions)** — New resource types (like Cluster, Backup)
- **Controllers** — Loops that watch resources and act to reach desired state

Common operators:
- CNPG — PostgreSQL cluster management
- cert-manager — SSL certificate management (technically an operator)
- DISCO — Automatic DNS record management
- Prometheus Operator — Monitoring setup

Important: Operators require cluster-admin to install. On shared clusters, check with your admin first.

---

### What is a Container Registry?

A container registry stores Docker images — like GitHub but for containers.

Common public registries: Docker Hub (docker.io), GitHub Container Registry (ghcr.io), Quay.io

Why companies run private registries:
- Security: control what images are allowed to run
- Speed: local images pull faster
- Compliance: audit trail of what's running
- Policy enforcement: reject images without required labels

Important: If your company has a private registry, you MUST use it. Kubernetes admission policies (like Gatekeeper) may reject pods using public images. Always check what image patterns existing pods use before deploying.

---

## Prerequisites

### Tools Required

```bash
# kubectl
brew install kubectl

# helm
brew install helm

# OpenStack CLI
pip install python-openstackclient

# Docker Desktop
# https://www.docker.com/products/docker-desktop
```

---

## Scenario A: Creating Your Own Cluster on OpenStack

Skip to Scenario B if you already have cluster access.

### 1. Configure OpenStack CLI

```bash
export OS_AUTH_URL=https://identity.<region>.cloud.example.com/v3
export OS_PROJECT_NAME=my-project
export OS_USERNAME=my-username
export OS_PASSWORD=my-password
export OS_REGION_NAME=my-region

openstack token issue   # Verify it works
```

### 2. Create a Kubernetes Cluster

OpenStack uses Magnum to manage Kubernetes clusters.

```bash
# See available Kubernetes versions
openstack coe cluster template list

# Create cluster
openstack coe cluster create my-cluster \
  --cluster-template k8s-1.28 \
  --master-count 1 \
  --node-count 3 \
  --master-flavor m1.large \
  --flavor m1.xlarge

# Watch creation (10-15 minutes)
watch openstack coe cluster list

# Once CREATE_COMPLETE, download kubeconfig
openstack coe cluster config my-cluster > ~/.kube/config
kubectl get nodes
```

### 3. Verify the Cluster

```bash
kubectl get nodes           # All should show STATUS=Ready
kubectl get pods --all-namespaces   # System pods Running
kubectl get storageclass    # Note what's available
kubectl get ingressclass    # Note ingress controllers
```

---

## Scenario B: Using an Existing Cluster

### 1. Get Cluster Access

```bash
kubectl config use-context <cluster-name>
kubectl cluster-info
kubectl get nodes
```

### 2. Investigate Before Touching Anything

This step saves hours of debugging. Spend 10 minutes here.

```bash
# What storage classes exist? (use these, don't create your own)
kubectl get storageclass

# What ingress controllers are available?
kubectl get ingressclass

# Are there admission policies that might block your deployment?
kubectl get constrainttemplate 2>/dev/null

# What image registry do existing pods use? (COPY THIS PATTERN!)
kubectl get pods --all-namespaces \
  -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' \
  | sort -u | head -20

# Study a working deployment similar to what you want
kubectl get deployment <some-existing-app> -n <its-namespace> -o yaml
```

Pro Tip: The last command is the most valuable thing you can do. Find a working app similar to yours and copy its patterns. Other teams have already solved the hard cluster-specific problems.

---

## Setting Up Your Namespace

A namespace is a virtual partition isolating your resources from other teams.

```bash
kubectl create namespace mattermost
kubectl config set-context --current --namespace=mattermost
kubectl get namespace mattermost
```

Why it matters:
```
cluster
├── namespace: team-a      ← Their resources (you can't see their secrets)
└── namespace: mattermost  ← Your resources (isolated)
    ├── pod: mattermost
    └── pod: postgres
```

---

## Storage: Persistent Volumes

### Why Persistent Storage Matters

Containers are ephemeral — they lose everything when they restart. For a database this means losing all data. Persistent Volumes store data outside the container on a durable volume.

The three components:
- **StorageClass** — Type of storage (provisioned by cluster admins)
- **PersistentVolumeClaim (PVC)** — Your request: "I need 10GB"
- **PersistentVolume (PV)** — The actual storage created and bound to your PVC

```
App → PVC ("I need 10GB") → StorageClass → PV (actual disk created)
```

### Check Available Storage Classes First

```bash
kubectl get storageclass

# Example output on OpenStack:
# NAME                      PROVISIONER                    DEFAULT
# cinder-default (default)  cinder.csi.openstack.org         ✓
# cinder-hdd                kubernetes.io/cinder
```

On shared clusters: Always use an existing StorageClass. Never create your own without cluster-admin.

Common storage classes by environment:

| Environment | StorageClass | Notes |
|-------------|-------------|-------|
| OpenStack | cinder-default | Standard block storage |
| AWS | gp2 or gp3 | EBS volumes |
| GCP | standard | Persistent Disk |
| Azure | default | Azure Disk |
| Minikube | standard | Local storage |

### Create a PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: mattermost
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: cinder-default   # Change to your storage class!
  resources:
    requests:
      storage: 10Gi
```

```bash
kubectl apply -f postgres-pvc.yaml
kubectl get pvc   # Status should be Bound
```

---

## Container Images and Registries

### Finding Your Company's Registry

```bash
kubectl get pods --all-namespaces \
  -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' \
  | sort -u | grep -v "^$" | head -20

# You'll see a pattern like:
# registry.mycompany.com/team/postgres:latest
```

### Check If Your Image Exists

```bash
docker pull registry.mycompany.com/mattermost/mattermost-team-edition:latest
# If not found, you need to upload it
```

### Uploading an Image to a Private Registry

```bash
docker pull mattermost/mattermost-team-edition:latest
docker login registry.mycompany.com

# Build for correct platform with required labels
docker buildx build --platform linux/amd64 \
  -t registry.mycompany.com/mattermost/mattermost-team-edition:latest \
  --push - <<DOCKERFILE
FROM --platform=linux/amd64 mattermost/mattermost-team-edition:latest
LABEL source_repository="https://github.com/mattermost/mattermost"
DOCKERFILE
```

Mac Users (Apple Silicon): Always add --platform linux/amd64 when building for production clusters. Your Mac is ARM64 but most clusters run AMD64. Without this you'll get a cryptic "exec format error" or "no match for platform" at runtime.

---

## Setting Up Object Storage

Mattermost needs object storage for file uploads (images, attachments, documents).

### Using OpenStack Swift

```bash
# Create a bucket
openstack container create mattermost-files
openstack container list

# Create S3-compatible credentials
openstack ec2 credentials create
# Note: access key and secret key in output

# Test that uploads work
echo "test" > test.txt
openstack object create mattermost-files test.txt
openstack object list mattermost-files   # Should show test.txt ✅
openstack object delete mattermost-files test.txt
```

Important: Create EC2 credentials AFTER you have the objectstore_admin role. Credentials created without proper permissions will appear valid but fail at runtime with "signature mismatch" errors. If you add permissions later, create fresh credentials.

### Store Credentials in Kubernetes

```bash
kubectl create secret generic mattermost-storage-credentials \
  --from-literal=accesskey='your-access-key' \
  --from-literal=secretkey='your-secret-key' \
  -n mattermost
```

---

## Deploying PostgreSQL

### Choose Your Approach

| Approach | Best For | Complexity |
|----------|----------|------------|
| Simple StatefulSet | POC / Development | Low |
| Helm Chart | When charts are allowed | Medium |
| Operator (CNPG) | Production HA | Medium-High |

### Option 1: Simple StatefulSet

```yaml
# postgres-deployment.yaml
---
apiVersion: v1
kind: Secret
metadata:
  name: mattermost-db-credentials
  namespace: mattermost
type: Opaque
stringData:
  username: mattermost
  password: "YourSecurePassword123!"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: mattermost
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: cinder-default   # Change to your storage class!
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: mattermost
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine   # Or your company registry equivalent
        env:
        - name: POSTGRES_DB
          value: mattermost
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: mattermost-db-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mattermost-db-credentials
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command: ["pg_isready", "-U", "mattermost"]
          initialDelaySeconds: 30
          periodSeconds: 10
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: mattermost
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### If Your Company Has a Custom PostgreSQL Image

Some companies maintain custom PostgreSQL images (like postgres-ng) with specific requirements different from the standard image:

```yaml
containers:
- name: postgres
  image: registry.mycompany.com/postgres-ng:latest
  env:
  - name: PGVERSION
    value: "17"                          # Must explicitly set version
  - name: PGBIN
    value: /usr/lib/postgresql/17/bin
  - name: PGDATA
    value: /var/lib/postgresql/17
  - name: PGUSER
    value: postgres
  - name: PGAUTHMETHOD
    value: scram-sha-256
  - name: DATABASES
    value: "mattermost"
  - name: USERS
    value: "mattermost"
  - name: USER_PASSWORD_mattermost      # Pattern: USER_PASSWORD_<username>
    valueFrom:
      secretKeyRef:
        name: mattermost-db-credentials
        key: password
  volumeMounts:
  - name: data
    mountPath: /data                     # NOT /var/lib/postgresql!
  - name: postgres-config
    mountPath: /etc/postgresql           # Requires ConfigMap with postgresql.conf
  - name: sql-on-startup
    mountPath: /sql-on-startup.d         # Requires SQL init scripts ConfigMap
```

Lesson learned: Custom images have custom conventions. Find an existing deployment of the same image in the cluster and copy its configuration exactly.

### Option 2: Helm Chart

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install mattermost-db bitnami/postgresql \
  --namespace mattermost \
  --set auth.username=mattermost \
  --set auth.password=YourSecurePassword \
  --set auth.database=mattermost \
  --set primary.persistence.storageClass=cinder-default \
  --set primary.persistence.size=10Gi
```

### Option 3: Operator (CNPG) — Production HA

```bash
# Check if already installed
kubectl get crd | grep postgresql.cnpg.io

# Install if needed (requires cluster-admin)
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system --create-namespace
```

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: mattermost-db
  namespace: mattermost
spec:
  instances: 3
  storage:
    size: 10Gi
    storageClass: cinder-default
```

### Verify PostgreSQL is Running

```bash
kubectl apply -f postgres-deployment.yaml
kubectl get pods -w

kubectl exec -it postgres-0 -- psql -U mattermost -d mattermost -c "\dt"
# Expected: "Did not find any tables" — correct, Mattermost creates them on first start
```

---

## Deploying Mattermost

```yaml
# mattermost-deployment.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mattermost
  namespace: mattermost
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mattermost
  template:
    metadata:
      labels:
        app: mattermost
    spec:
      containers:
      - name: mattermost
        # Use your company registry if required:
        # image: registry.mycompany.com/mattermost/mattermost-team-edition:latest
        image: mattermost/mattermost-team-edition:latest

        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"

        env:
        - name: MM_SQLSETTINGS_DRIVERNAME
          value: "postgres"
        - name: MM_SQLSETTINGS_DATASOURCE
          value: "postgres://mattermost:YourSecurePassword123!@postgres.mattermost.svc:5432/mattermost?sslmode=disable"

        - name: MM_FILESETTINGS_DRIVERNAME
          value: "amazons3"
        - name: MM_FILESETTINGS_AMAZONS3ACCESSKEYID
          valueFrom:
            secretKeyRef:
              name: mattermost-storage-credentials
              key: accesskey
        - name: MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY
          valueFrom:
            secretKeyRef:
              name: mattermost-storage-credentials
              key: secretkey
        - name: MM_FILESETTINGS_AMAZONS3BUCKET
          value: "mattermost-files"
        - name: MM_FILESETTINGS_AMAZONS3ENDPOINT
          value: "objectstore.myregion.cloud.example.com"
        - name: MM_FILESETTINGS_AMAZONS3REGION
          value: "my-region"
        - name: MM_FILESETTINGS_AMAZONS3SSL
          value: "true"
        # Required for OpenStack Swift compatibility
        - name: MM_FILESETTINGS_AMAZONS3SIGNV2
          value: "true"
        - name: MM_FILESETTINGS_AMAZONS3PATHSTYLE
          value: "true"

        - name: MM_SERVICESETTINGS_SITEURL
          value: "https://mattermost.mycompany.com"

        ports:
        - containerPort: 8065
          name: http
        - containerPort: 8067
          name: metrics

        livenessProbe:
          httpGet:
            path: /api/v4/system/ping
            port: 8065
          initialDelaySeconds: 90
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v4/system/ping
            port: 8065
          initialDelaySeconds: 15
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mattermost
  namespace: mattermost
spec:
  selector:
    app: mattermost
  ports:
  - port: 8065
    targetPort: 8065
    name: http
  - port: 8067
    targetPort: 8067
    name: metrics
  type: ClusterIP
```

```bash
kubectl apply -f mattermost-deployment.yaml
kubectl get pods -w

# Quick test before DNS is set up
kubectl port-forward svc/mattermost 8065:8065
# Open http://localhost:8065
```

Why environment variables instead of UI settings? Settings configured via the Mattermost UI are stored inside the container. When the pod restarts, they are gone. Environment variables in your deployment YAML survive restarts. Always prefer env vars for persistent configuration.

---

## Ingress, DNS and SSL

### What is an Ingress?

An Ingress routes external HTTP/HTTPS traffic to the right service inside your cluster.

```
Internet
    ↓
Ingress Controller (ONE shared IP for ALL services)
    ↓
Ingress Rules (route by hostname)
    ├── mattermost.company.com → mattermost Service
    ├── grafana.company.com    → grafana Service
    └── jenkins.company.com    → jenkins Service
```

Without Ingress, each service needs its own IP. With Ingress, all services share one IP and are routed by hostname.

### Step 1: Check the Ingress Controller

```bash
kubectl get ingressclass
# NAME    CONTROLLER
# nginx   k8s.io/ingress-nginx
```

### Step 2: Find the DNS Naming Pattern

Look at existing ingresses — they show the correct format to use:

```bash
kubectl get ingress --all-namespaces
# NAMESPACE  NAME   HOSTS
# team-a     app1   app1.cluster.region.company.com
```

Use the same pattern: mattermost.cluster.region.company.com

### Step 3: DNS Options

**Option A — Automatic DNS via DISCO operator**

Some clusters auto-create DNS records when you annotate your Ingress:

```yaml
metadata:
  annotations:
    disco: "true"   # DNS record created automatically!
```

Check if available:
```bash
kubectl get pods --all-namespaces | grep -i disco
```

**Option B — Manual DNS**

```bash
openstack recordset create myzone.company.com. mattermost \
  --type CNAME \
  --record ingress.cluster.region.company.com.

nslookup mattermost.cluster.region.company.com
```

**Option C — Test without DNS first**

Always verify Ingress routing works before fighting DNS:

```bash
# Simulates what DNS does
curl -H "Host: mattermost.cluster.region.company.com" http://<ingress-ip>
# If this returns HTML → Ingress works, only DNS is missing ✅

# Temporary local workaround
echo "<ingress-ip> mattermost.cluster.region.company.com" | sudo tee -a /etc/hosts
```

### Step 4: Create the Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mattermost
  namespace: mattermost
  annotations:
    disco: "true"                                          # Auto DNS
    kubernetes.io/tls-acme: "true"                       # Auto SSL
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"  # File upload limit
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - mattermost.cluster.region.company.com
    secretName: mattermost-tls
  rules:
  - host: mattermost.cluster.region.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mattermost
            port:
              number: 8065
```

```bash
kubectl apply -f mattermost-ingress.yaml

kubectl set env deployment/mattermost \
  MM_SERVICESETTINGS_SITEURL=https://mattermost.cluster.region.company.com

kubectl delete pod -l app=mattermost   # Restart to apply
```

### What is cert-manager?

cert-manager automatically requests, stores, and renews SSL certificates. Once installed in the cluster, one annotation is all you need:

```yaml
annotations:
  kubernetes.io/tls-acme: "true"
```

cert-manager detects this, requests a certificate, stores it as a Kubernetes secret, and renews it before expiry.

```bash
kubectl get certificate -n mattermost
# NAME             READY   SECRET           AGE
# mattermost-tls   True    mattermost-tls   5m  ✅
```

---

## Configuring Mattermost

### First Login

1. Open your Mattermost URL
2. Create your admin account
3. If SMTP is not configured, verify your email via the database:

```bash
kubectl exec -it postgres-0 -- psql -U mattermost -d mattermost
UPDATE users SET emailverified = true WHERE username = 'your-username';
\q
```

### Key Settings (Menu → System Console)

Allow self-registration:
```
Authentication → Signup → Enable Open Server: True
```

Verify file storage:
```
Environment → File Storage → Test Connection → Should show: Connection successful
```

Enable calls and screen sharing:
```
Plugins → Calls
  Enable Plugin: True
  Allow Screen Sharing: True
  Enable Call Ringing: True  (requires plugin restart: disable then re-enable plugin)
  Max Call Participants: 0   (unlimited)
```

Enable integrations for CI/CD and webhooks:
```
Integrations → Integration Management
  Enable Incoming Webhooks: True
  Enable Outgoing Webhooks: True
  Enable Custom Slash Commands: True
  Personal Access Tokens: True
```

### Inviting Team Members

```bash
# Easiest: share an invite link
# Click your username → Invite People → Copy Link → Share it

# Make someone an admin via database
kubectl exec -it postgres-0 -- psql -U mattermost -d mattermost
UPDATE users SET roles = 'system_admin system_user' WHERE username = 'colleague';
\q
```

---

## Making It Production-Ready

### 1. Scale to Multiple Replicas

```bash
kubectl scale deployment mattermost --replicas=3
kubectl get pods -l app=mattermost   # Should show 3 pods Running
```

### 2. Add Resource Limits

Without limits, one busy pod can consume all node memory and starve other workloads.

```yaml
resources:
  requests:
    memory: "512Mi"   # Guaranteed minimum
    cpu: "500m"       # 0.5 CPU cores minimum
  limits:
    memory: "2Gi"     # Pod killed and restarted if exceeded
    cpu: "2000m"      # Pod throttled (not killed) if exceeded
```

CPU units: 1000m = 1 CPU core, 500m = 0.5 cores

### 3. Automate Database Backups

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: mattermost
spec:
  schedule: "0 2 * * *"   # Daily at 2am
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -U mattermost -h postgres mattermost \
                > /backup/mattermost-$(date +%Y%m%d).sql
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: mattermost-db-credentials
                  key: password
          restartPolicy: OnFailure
```

### 4. Prevent Downtime During Maintenance

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mattermost-pdb
  namespace: mattermost
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: mattermost
```

### 5. Monitor Resource Usage

```bash
kubectl top pods -n mattermost
kubectl describe pod <pod> | grep -i "oom\|killed\|restart"
kubectl get events --sort-by=.lastTimestamp -n mattermost
```

### Production Readiness Checklist

- [ ] Mattermost scaled to 3+ replicas
- [ ] Resource limits set on all pods
- [ ] PostgreSQL backup CronJob running
- [ ] PodDisruptionBudget created
- [ ] SSL certificate valid and auto-renewing
- [ ] File uploads tested and working
- [ ] Admin password is strong and documented
- [ ] Email notifications configured (or team knows it is not available)
- [ ] Monitoring configured

---

## Troubleshooting Guide

### Pod Won't Start

```bash
kubectl get pods
kubectl describe pod <pod-name>   # Check Events section at the bottom
kubectl logs <pod-name>
kubectl logs <pod-name> --previous   # Logs from previous crashed instance
```

### Common Errors

**ImagePullBackOff**
- Image not found, wrong registry, or auth failure
- Fix: Verify image matches your registry pattern; upload if needed; build with --platform linux/amd64 on Mac

**OOMKilled (Exit Code 137)**
- Pod exceeded memory limit
- Fix: Increase memory limit; check kubectl top pods for actual usage; add replicas to spread load

**S3 / Swift: Access Denied**
- Wrong credentials or missing objectstore_admin role
- Fix: Add objectstore_admin role, create NEW EC2 credentials, update Kubernetes secret, restart pod

**DNS NXDOMAIN**
- DNS record not created
- Fix: Check disco: "true" annotation on Ingress; verify hostname matches cluster pattern; create record manually

**Settings Revert After Restart**
- UI settings stored inside container, lost on restart
- Fix: Use environment variables: kubectl set env deployment/mattermost KEY=value

**Database Connection Failed**
- Wrong connection string or PostgreSQL not ready
- Fix: kubectl get pods -l app=postgres; test connection directly; verify service exists

---

## Lessons Learned

**Investigate before you deploy.** Ten minutes of kubectl get commands saves hours. The cluster has conventions. Working with them is easier than fighting them.

**Copy patterns from working deployments.** Other teams have already solved cluster-specific problems. Their working YAML is the best documentation available.

**Request all permissions upfront.** Permissions walls mid-deployment are frustrating. Request everything at once before you start.

**Custom images have custom requirements.** Company-specific images have unique environment variables, volume paths, and required ConfigMaps. Find an existing deployment of the same image — do not guess.

**Environment variables over UI config.** Anything stored inside a container is gone when it restarts. All persistent configuration belongs in your deployment YAML.

**Separate your debugging.** Test Ingress routing with curl before fighting DNS. Test DNS before debugging SSL. Mixing problem layers wastes time.

**Platform architecture matters.** On Apple Silicon Macs, always build with --platform linux/amd64. The resulting error without it is cryptic and hard to trace.

**Object storage credentials and permissions are linked.** Create EC2 credentials only after you have the right storage role. Existing credentials will not automatically pick up new permissions.

**DNS automation exists — find it first.** Before waiting days for DNS approval, check if your cluster has automated DNS (like DISCO). One annotation may be all you need.

**Read the error message.** Kubernetes errors are usually precise. PGVERSION: unbound variable means: set the PGVERSION environment variable. That is the entire fix.

---

## Quick Reference

```bash
# Cluster navigation
kubectl config use-context <cluster>
kubectl config set-context --current --namespace=<ns>

# Viewing resources
kubectl get pods
kubectl get pods -w                           # Watch live
kubectl describe pod <name>                   # Details and events
kubectl logs <pod>                            # Logs
kubectl logs -f <pod>                         # Stream logs
kubectl logs <pod> --previous                 # Previous instance logs

# Modifying deployments
kubectl apply -f file.yaml
kubectl set env deployment/<name> KEY=value
kubectl edit deployment <name>
kubectl scale deployment <name> --replicas=3
kubectl delete pod -l app=<name>              # Restart by label
kubectl rollout undo deployment/<name>        # Rollback

# Storage
kubectl get pvc
kubectl get storageclass

# Networking
kubectl get ingress
kubectl get svc
kubectl port-forward svc/<name> 8080:80
kubectl get certificate

# Debugging
kubectl top pods
kubectl get events --sort-by=.lastTimestamp
kubectl exec -it <pod> -- /bin/bash
kubectl exec -it postgres-0 -- psql -U mattermost -d mattermost

# OpenStack
openstack container list
openstack object list <container>
openstack ec2 credentials create
nslookup <hostname>
```

---

## Resources

- Mattermost Documentation: https://docs.mattermost.com
- Mattermost API Reference: https://api.mattermost.com
- Kubernetes Documentation: https://kubernetes.io/docs
- Helm Documentation: https://helm.sh/docs
- cert-manager Documentation: https://cert-manager.io/docs
- CloudNativePG Operator: https://cloudnative-pg.io
- NGINX Ingress Controller: https://kubernetes.github.io/ingress-nginx
- OpenStack Documentation: https://docs.openstack.org