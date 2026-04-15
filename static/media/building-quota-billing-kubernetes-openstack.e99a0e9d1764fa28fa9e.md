## Introduction

This is a deep-dive into everything I learned while adding per-project quota enforcement and billing rate tracking to a Private Certificate Authority (PCA) service running on Kubernetes in a large-scale OpenStack cloud.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Designing the CRD: Why Not Just Use a Database?](#designing-the-crd-why-not-just-use-a-database)
3. [Controller-Gen: Generating CRDs from Go Types](#controller-gen-generating-crds-from-go-types)
4. [Maps vs Flat Fields in CRD Design](#maps-vs-flat-fields-in-crd-design)
5. [Server-Side Apply (SSA) vs Traditional Update](#server-side-apply-ssa-vs-traditional-update)
6. [ResourceVersion and Optimistic Concurrency Control](#resourceversion-and-optimistic-concurrency-control)
7. [Kubernetes RBAC for CRDs](#kubernetes-rbac-for-crds)
8. [Registering Custom Types with the K8s Client (Scheme Registration)](#registering-custom-types-with-the-k8s-client)
9. [The Decorator Pattern: Clean Separation of Concerns](#the-decorator-pattern-clean-separation-of-concerns)
10. [Package Organisation: Where Does Business Logic Live?](#package-organisation-where-does-business-logic-live)
11. [The LIQUID Protocol: Making Your Service Discoverable to Limes](#the-liquid-protocol-making-your-service-discoverable-to-limes)
12. [OpenStack Seed: Registering in the Keystone Service Catalog](#openstack-seed-registering-in-the-keystone-service-catalog)
13. [The Full Discovery Chain: Seed -> Catalog -> Limes -> Your API](#the-full-discovery-chain)
14. [Helm Deployment: Tying It All Together](#helm-deployment-tying-it-all-together)
15. [REUSE Compliance: Licensing Auto-Generated Files](#reuse-compliance-licensing-auto-generated-files)
16. [Key Takeaways](#key-takeaways)

---

## The Problem

The service is a Private Certificate Authority (PCA) API. It lets OpenStack projects create Certificate Authorities and issue X.509 certificates, backed by HSMs via cert-manager.

But we had no answer to: *"How many CAs can a project create? How do we bill for certificate issuance?"*

We needed:
- **Per-project quota enforcement** — limit CA instances per project
- **Rate counting for billing** — track CA creations, intermediate CA signings, and end-entity cert issuances
- **Limes integration** — expose all of this via the LIQUID protocol so Limes (the cloud's quota/billing system) can manage it

This required touching almost every layer of the stack: Go type definitions, Kubernetes CRDs, RBAC, Helm charts, Keystone catalog registration, and a new HTTP API protocol. Each piece had its own lessons.

---

## Designing the CRD: Why Not Just Use a Database?

The service already runs on Kubernetes and stores everything as Kubernetes resources — cert-manager `CertificateRequest` objects and custom issuer CRDs. We had two choices for storing quota data:

1. **External database** (PostgreSQL, etc.)
2. **Kubernetes Custom Resource Definition (CRD)** stored in etcd

We chose a CRD because:
- **No new infrastructure** — no database to provision, back up, or manage
- **Consistency** — same storage model as everything else in the service
- **Native tooling** — `kubectl get projectquotas` just works
- **Simplicity** — for our scale (one quota record per project, not millions of rows), etcd is perfectly adequate

The result is a simple `ProjectQuota` CRD:

```go
type ProjectQuota struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec ProjectQuotaSpec `json:"spec,omitempty"`
}

type ProjectQuotaSpec struct {
    ProjectID string            `json:"projectID"`
    Quotas    map[string]uint64 `json:"quotas,omitempty"`
    Rates     map[string]uint64 `json:"rates,omitempty"`
}
```

One CR per project. Quotas and rates are stored as maps. This single object is the source of truth for both quota enforcement and billing counters.

### The bigger picture

CRDs are a first-class extension mechanism in Kubernetes. The API server treats them identically to built-in resources — you get RBAC, watches, listing, server-side filtering, and etcd durability for free. This is why many Kubernetes-native tools (cert-manager, Prometheus Operator, Crossplane) use CRDs as their persistence layer.

The question of "CRD vs database" comes down to **scale and query patterns**. etcd is optimised for small objects (< 1 MB each) and key-based lookups, not analytical queries or high write throughput. For a quota store with one record per project and simple reads/writes, it is the right choice. For a logging pipeline processing millions of events, it is not.

**To learn more**: [Kubernetes CRD documentation](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/), [Kubebuilder book](https://book.kubebuilder.io/)

---

## Controller-Gen: Generating CRDs from Go Types

The YAML CRD manifest (e.g. `myapp.example.com_projectquotas.yaml`) is **auto-generated** from Go types using `controller-gen`:

```bash
# Generate deepcopy methods (required for runtime serialisation)
controller-gen object:headerFile="hack/boilerplate.go.txt" paths="./internal/quota/v1alpha1/..."

# Generate the CRD YAML manifest from kubebuilder marker comments
controller-gen crd paths="./internal/quota/v1alpha1/..." output:crd:artifacts:config=config/crd/bases
```

Marker comments on the struct control what ends up in the generated CRD:

```go
// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Namespaced,shortName=pq
// +kubebuilder:printcolumn:name="Project",type="string",JSONPath=".spec.projectID"
// +kubebuilder:printcolumn:name="CA Quota",type="integer",JSONPath=".spec.quotas.ca_instances"
```

The generated file `zz_generated.deepcopy.go` contains the `DeepCopyObject()` method required by the Kubernetes runtime. The `zz_` prefix is a convention meaning "generated — do not edit". Both files must be committed to git so the repo builds without running code generation.

**Key lesson**: The generated YAML and deepcopy files will be overwritten every time you run `controller-gen`. Never add inline headers to them and never hand-edit them — regenerate instead.

### The bigger picture

`controller-gen` is part of the [controller-tools](https://github.com/kubernetes-sigs/controller-tools) project. The marker comment approach (specially-formatted Go comments that drive code generation) is a common pattern in the Go ecosystem — you also see it in `go:generate`, `mockgen`, and `stringer`. The idea is to keep the source of truth in one place (the Go type) and derive everything else from it.

The `zz_generated.deepcopy.go` file exists because Go interfaces require explicit deep-copy implementations, unlike languages with reflection-based copy. Kubernetes uses deep copy extensively to prevent accidental mutation of cached objects.

**To learn more**: [controller-tools markers reference](https://book.kubebuilder.io/reference/markers.html), [Kubebuilder tutorial](https://book.kubebuilder.io/cronjob-tutorial/other-api-files.html)

---

## Maps vs Flat Fields in CRD Design

A critical design decision: should quota values be flat fields or a map?

**Option A: Flat fields**
```go
type ProjectQuotaSpec struct {
    CAInstancesQuota     uint64 `json:"caInstancesQuota"`
    CACreatedRate        uint64 `json:"caCreatedRate"`
    EECertSignedRate     uint64 `json:"eeCertSignedRate"`
}
```

**Option B: Maps** (what we chose)
```go
type ProjectQuotaSpec struct {
    Quotas map[string]uint64 `json:"quotas,omitempty"`
    Rates  map[string]uint64 `json:"rates,omitempty"`
}
```

We chose maps because:
- **Extensibility** — adding a new quota or rate type does not require a CRD schema change or migration
- **LIQUID compatibility** — the LIQUID protocol represents resources and rates as maps, so the data model maps directly
- **Server-Side Apply field ownership** — SSA tracks individual map keys as owned fields (see next section), so independent writers can update different keys without conflicting

**Trade-off**: Maps sacrifice compile-time type safety. We mitigate this with typed constants:

```go
const (
    ResourceCAInstances      liquid.ResourceName = "ca_instances"
    RateCACreated            liquid.RateName     = "ca_created"
    RateIntermediateCASigned liquid.RateName     = "intermediate_ca_signed"
    RateEECertSigned         liquid.RateName     = "ee_cert_signed"
)
```

And generic conversion helpers to go between `map[string]uint64` (CRD storage) and `map[liquid.ResourceName]uint64` (business logic):

```go
func convertToTypedKeys[K ~string, V any](m map[string]V) map[K]V {
    result := make(map[K]V, len(m))
    for k, v := range m {
        result[K(k)] = v
    }
    return result
}
```

### The code review debate

This was genuinely debated in our PR review. The concern raised was that maps in CRDs are "not always recommended" — the reasoning being that flat fields allow per-field conflict resolution via SSA and that a map could grow unbounded.

Our counter-argument: in our case there is only **one field owner** (our service). Limes never directly writes to the CRD — it calls our HTTP API and we write to the CRD. So there are no ownership conflicts to resolve. The resource set is also bounded (we know exactly what we bill for). And SSA already tracks map keys as individual managed fields.

**Lesson**: Don't apply a rule cargo-cult style. Understand *why* the rule exists and evaluate whether that reason actually applies to your situation.

### The bigger picture

The flat-vs-map debate is really a specialisation of schema design trade-offs you see everywhere: strict schema (relational databases, Protobuf) vs flexible schema (document stores, maps). Strict schemas give you compiler guarantees and indexing. Flexible schemas give you extensibility without migrations. Neither is universally correct.

In Kubernetes CRDs, the additional dimension is that the schema is enforced by the API server via OpenAPI validation. Maps with `additionalProperties` pass any key through; flat fields are explicitly enumerated in the schema.

**To learn more**: [Kubernetes API conventions — maps](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md), [KEP-555 SSA maps and structs](https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/555-server-side-apply#maps-and-structs)

---

## Server-Side Apply (SSA) vs Traditional Update

This was one of the biggest learning moments. We have **two different write paths** for the same CRD:

| Writer | What it writes | When |
|--------|---------------|------|
| **Limes** (via our LIQUID API) | `quotas` map | When an admin sets a project quota |
| **Our service** (internally) | `rates` map | On every CA creation / cert issuance |

With a traditional `Update`, the last writer wins — Limes setting a quota would overwrite rate counters, and vice versa, because `Update` replaces the **entire object**.

**Server-Side Apply (SSA)** solves this with **field-level ownership**:

```go
// SetProjectQuota uses SSA — Limes (via our API) writes quotas, we own rates separately
err := s.client.Patch(ctx, pq, ctrlclient.Apply, fieldOwner, ctrlclient.ForceOwnership)
```

With SSA, the API server tracks which field manager owns which fields. A manager only touches the fields it declares — other fields are left untouched.

### The `ForceOwnership` flag

`ForceOwnership` means "if another manager already owns these fields, take ownership from them". Without it, you'd get a conflict error when a field is claimed by multiple managers. For a single-owner scenario like ours, `ForceOwnership` is safe and prevents spurious errors.

### When SSA Doesn't Work: Rate Increments

SSA has a subtle but critical limitation: **it ignores `ResourceVersion`**. This means it cannot perform optimistic concurrency control.

For rate counters that are incremented concurrently (multiple cert issuances happening simultaneously), you need atomic read-modify-write. If two goroutines both read `counter=5` and both SSA-write `counter=6`, you get `6` instead of `7` — a silently dropped increment.

The original code had this exact bug:
```go
// BUG: SSA ignores ResourceVersion — the retry loop is dead code
pq.ObjectMeta.ResourceVersion = existingPQ.ResourceVersion  // SSA ignores this
client.Patch(ctx, pq, ctrlclient.Apply, fieldOwner, ctrlclient.ForceOwnership)
// ForceOwnership means IsConflict can never be returned — the loop never retries
```

The fix is `Get` + `Update` with a retry loop:

```go
func (s *K8sCRDStore) IncrementRate(ctx context.Context, projectID string, rateName liquid.RateName, delta uint64) error {
    for range 5 { // retry up to 5 times on conflict
        var pq v1alpha1.ProjectQuota
        s.client.Get(ctx, ..., &pq) // reads current value AND ResourceVersion

        pq.Spec.Rates[string(rateName)] += delta

        err := s.client.Update(ctx, &pq) // fails with 409 if ResourceVersion changed
        if apierrors.IsConflict(err) {
            continue // someone else updated — re-read and retry
        }
        return err
    }
    return ErrConflict
}
```

**Rule of thumb**:

| Use case | Mechanism |
|----------|-----------|
| Multiple managers writing to **different fields** | SSA (`Patch` + `Apply` + `FieldOwner`) |
| **Atomic read-modify-write** on the same field | `Get` + `Update` with `ResourceVersion` retry |

### The bigger picture

SSA was introduced in Kubernetes 1.18 to solve the "last-write-wins" problem that affected multi-controller scenarios. Before SSA, the typical workaround was strategic merge patches, which had confusing semantics around list merging and deletions.

SSA is conceptually similar to the `If-Match` header in HTTP (optimistic concurrency via ETags), or CAS (compare-and-swap) operations in databases. The key insight is that field ownership is tracked server-side — the client doesn't need to coordinate with other clients directly.

The `ResourceVersion`-based `Update` approach is the older, simpler pattern and still the right choice for read-modify-write operations where you need the current value to compute the new one.

**To learn more**: [Kubernetes SSA documentation](https://kubernetes.io/docs/reference/using-api/server-side-apply/), [controller-runtime SSA guide](https://github.com/kubernetes-sigs/controller-runtime/blob/main/FAQ.md), [KEP-555](https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/555-server-side-apply)

---

## ResourceVersion and Optimistic Concurrency Control

Every Kubernetes object has a `metadata.resourceVersion` — an opaque string (backed by the etcd revision number) that changes on every write:

```yaml
metadata:
  name: my-project-quota
  resourceVersion: "12345"  # changes every write
```

When you call `client.Update(ctx, obj)`:
1. Your object must have `resourceVersion` set (controller-runtime does this automatically after a `Get`)
2. The API server checks: does this version match what is currently in etcd?
3. Match → apply the update, bump `resourceVersion`
4. No match → reject with `409 Conflict`

This is the Kubernetes equivalent of compare-and-swap (CAS) or an SQL `UPDATE ... WHERE version = ?`. It lets you build concurrency-safe operations without distributed locks.

### Important difference from SSA

`Patch` with `ctrlclient.Apply` (SSA) does **not** use `resourceVersion` for conflict detection — it merges fields based on ownership declarations. This is intentional: SSA is designed for idempotent "desired state" management, not transactional increments.

### The bigger picture

Optimistic concurrency control (OCC) is the alternative to pessimistic locking. Instead of acquiring a lock before modifying data, you read the current version, make your change, and check that nobody else modified it before you write back. If there is a conflict you retry.

OCC works well when conflicts are rare (low contention), which is true for per-project quota records — most requests touch different projects. It performs poorly under high contention because retries accumulate. For a heavily contended counter you would use a different approach (e.g. a dedicated counter service, Lua scripts in Redis, or `UPDATE ... SET counter = counter + 1` in a database).

etcd itself uses a similar mechanism: every key has a `modRevision` and you can use `txn` operations to do compare-and-swap at the etcd level. Kubernetes `resourceVersion` is a projection of this.

**To learn more**: [etcd concurrency documentation](https://etcd.io/docs/v3.5/learning/api/#transaction), [Kubernetes resource versions](https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions), [Optimistic vs pessimistic locking (Martin Fowler)](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html)

---

## Kubernetes RBAC for CRDs

When you create a CRD, your pod's ServiceAccount needs explicit RBAC permissions to interact with it. Kubernetes does not grant access to new resource types automatically — you add rules to a `ClusterRole` or `Role`:

```yaml
# helm-charts/my-service/templates/rbac.yaml
rules:
  - apiGroups: [ "myapp.example.com" ]
    resources: [ "issuers", "clusterissuers" ]
    verbs: [ "create", "get", "list", "patch", "update", "delete" ]

  # Added when we introduced the ProjectQuota CRD
  - apiGroups: [ "myapp.example.com" ]
    resources: [ "projectquotas" ]
    verbs: [ "create", "get", "list", "patch", "update", "delete" ]
```

**Key details**:
- `patch` is required for SSA — Server-Side Apply uses `PATCH`, not `PUT`
- `update` is required for traditional `Update` — it sends `PUT`
- The resource name is the **plural lowercase** of the CRD kind (`ProjectQuota` → `projectquotas`)
- The API group matches the `group` in `groupversion_info.go` (e.g. `myapp.example.com`)

Missing RBAC is the most common cause of `403 Forbidden` errors when first deploying a new CRD. The error message will say something like:
```
projectquotas.myapp.example.com is forbidden: User "system:serviceaccount:default:my-service" cannot get resource "projectquotas"
```

### The bigger picture

Kubernetes RBAC (Role-Based Access Control) is the authorisation layer for the Kubernetes API. Every request — whether from a human `kubectl` user or a pod's ServiceAccount — is evaluated against RBAC rules before being processed.

RBAC has four objects:
- `Role` / `ClusterRole` — defines a set of permissions (verbs on resources)
- `RoleBinding` / `ClusterRoleBinding` — binds a role to a subject (user, group, or ServiceAccount)

The `Cluster` prefix means cluster-scoped (across all namespaces). Namespace-scoped roles only grant access within a single namespace.

For production services, principle of least privilege applies: only grant the specific verbs and resource types the service actually needs. Don't use wildcards (`*`) in roles for production workloads.

**To learn more**: [Kubernetes RBAC documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/), [Kubernetes security best practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/)

---

## Registering Custom Types with the K8s Client

Before the controller-runtime client can read or write your CRD, it needs to know how to serialise and deserialise it. This happens via **scheme registration** — you register your Go types with the runtime scheme:

```go
// In main.go — called after creating the base client
must.Succeed(quota.RegisterScheme(client.Scheme()))
```

```go
// In internal/quota/kubernetes_quota_scheme.go
func RegisterScheme(scheme *runtime.Scheme) error {
    return v1alpha1.AddToScheme(scheme)
}
```

`AddToScheme` is generated by controller-gen and maps `GroupVersionKind` (e.g. `myapp.example.com/v1alpha1/ProjectQuota`) to the Go type `v1alpha1.ProjectQuota`.

If you forget this, you get a runtime error:
```
no kind is registered for the type v1alpha1.ProjectQuota in scheme
```

**Pattern**: Keep scheme registration modular — each package registers its own types, and `main.go` calls each function. This avoids import cycles (the `pki` package doesn't need to import `quota/v1alpha1`) and makes it clear which types are in play.

### The bigger picture

The Kubernetes runtime `Scheme` is a registry that maps between Go types and their `GroupVersionKind` identifiers. It's how the client knows whether to serialise a struct as `v1/Pod` or `apps/v1/Deployment` or `myapp.example.com/v1alpha1/ProjectQuota`.

This is a specific application of the [type registry pattern](https://martinfowler.com/bliki/PluginArchitecture.html). In Go, because there is no runtime type metadata (unlike Java reflection), the scheme must be populated explicitly at startup.

The same mechanism is used by the Kubernetes API server itself — all built-in types are registered in the same way. Custom types just add entries to the same registry.

---

## The Decorator Pattern: Clean Separation of Concerns

The quota enforcer is implemented as a **decorator** around the core PKI manager. It implements the same `pki.Manager` interface but intercepts calls to add quota logic:

```
HTTP handler
    │ calls pki.Manager interface
    ▼
enforcingManager  (quota/manager.go)
    │ checks quota BEFORE
    │ increments rate AFTER
    │ delegates to...
    ▼
CertManager  (pki/)
    │ creates the actual cert resources in K8s
```

The HTTP handler has no idea quota exists — it just calls the `pki.Manager` interface it was given:

```go
// HTTP handler — completely unaware of quota
ca, err := h.pkiManager.CreateCertificateAuthority(ctx, parentRef, id, resource, opts)
```

The enforcing manager intercepts it:

```go
func (m *enforcingManager) CreateCertificateAuthority(...) (*api.CertificateAuthority, error) {
    // 1. Check quota before delegating
    if m.enforcer != nil {
        if err := m.enforcer.CheckCACreation(ctx, parentRef.ID()); err != nil {
            return nil, err
        }
    }

    // 2. Delegate to real PKI manager
    ca, err := m.pkiManager.CreateCertificateAuthority(ctx, parentRef, id, resource, opts)
    if err != nil {
        return nil, err
    }

    // 3. Increment billing counter after success
    if m.quotaStore != nil {
        m.quotaStore.IncrementRate(ctx, parentRef.ID(), RateCACreated, 1)
    }
    return ca, nil
}
```

The enforcer and store are both nil-safe: passing `nil` as the enforcer skips quota enforcement (but rate counting still works). This is the feature flag — `QUOTA_ENFORCEMENT_ENABLED=false` means we pass `nil` as the enforcer, and the wrapper gracefully skips enforcement while still counting rates for billing.

### The bigger picture

The decorator pattern (also called the wrapper pattern) is one of the classic Gang of Four structural patterns. It is particularly powerful when combined with interfaces in Go: because Go interfaces are satisfied implicitly, you can wrap any value that satisfies `pki.Manager` with another value that also satisfies `pki.Manager`, transparently.

You see this pattern throughout the Go standard library and ecosystem:
- `http.Handler` middleware (wrapping a handler with auth, logging, rate limiting)
- `io.Reader` wrappers (`bufio.Reader`, `gzip.Reader`, `io.LimitReader`)
- gRPC interceptors

The key advantage is that each concern (PKI logic, quota enforcement, rate counting) lives in isolation and is independently testable. The PKI manager has no tests for quota. The quota enforcer has no tests for cert creation. You test each layer with mocks of the other.

**To learn more**: [Gang of Four Decorator pattern](https://refactoring.guru/design-patterns/decorator), [Go patterns — functional options and wrappers](https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis)

---

## Package Organisation: Where Does Business Logic Live?

We moved the quota-enforcing manager from `internal/k8s/` to `internal/quota/`. The guiding principle: **packages are about the domain concept they own, not the technology they use**.

```
internal/
├── pki/              # pki.Manager interface + Kubernetes cert implementation
│   └── manager.go    # the real cert operations (creates issuers, etc.)
│
├── quota/            # everything quota/billing — CRD types, store, enforcer, AND the decorator
│   ├── manager.go    # enforcingManager (the decorator wrapping pki.Manager)
│   ├── enforcer.go   # quota check logic
│   ├── storage_k8s_crd.go  # K8s-backed quota store
│   └── v1alpha1/     # CRD Go types (under internal/ — not a public contract)
│
├── httpapi/          # HTTP handlers — knows nothing about quota internals
│   ├── liquid.go     # LIQUID protocol endpoints
│   └── api.go        # main API handlers
│
└── (no more k8s/ business logic — just the client factory)
```

The `pki.Manager` interface lives in `internal/pki/` so both `internal/quota/` (decorator) and `internal/pki/` (implementation) can reference it without circular dependencies.

The `v1alpha1` package is under `internal/quota/v1alpha1/` rather than `api/v1alpha1/`. Putting CRD types outside `internal/` would imply they are a stable public API contract — which they are not. They are an implementation detail of how the service stores quota data.

### The bigger picture

Package design in Go has a few widely-accepted principles:
- Packages should be **cohesive** — everything in a package is about the same concept
- Packages should have **low coupling** — minimise imports between packages; import cycles are a compile error in Go
- `internal/` is enforced by the Go toolchain — code inside `internal/` can only be imported by code in the same module, preventing accidental public API contracts
- Interfaces should be defined where they are **used**, not where they are **implemented** (Go proverb: "accept interfaces, return structs")

The "k8s package has business logic" smell is a common one in Go services: you end up with a package that's named after a technology (`k8s`, `postgres`, `redis`) but contains business rules. The fix is to ask "what concept does this implement?" and move the code there.

**To learn more**: [Go package naming conventions](https://go.dev/blog/package-names), [Practical Go — package design](https://dave.cheney.net/practical-go/presentations/qcon-china.html#_package_design), [GopherCon 2018 — How Do You Structure Your Go Apps](https://www.youtube.com/watch?v=oL6JBUk6tj0)

---

## The LIQUID Protocol: Making Your Service Discoverable to Limes

[LIQUID](https://pkg.go.dev/github.com/sapcc/go-api-declarations/liquid) (Limes Interface for Quota and Usage Interrogation and Discovery) is the HTTP protocol Limes uses to talk to individual services. You implement 4 endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/info` | Declare your resources and rates (the "contract") |
| `POST` | `/v1/report-capacity` | Report total available capacity |
| `POST` | `/v1/projects/{id}/report-usage` | Report per-project usage and rate counters |
| `PUT` | `/v1/projects/{id}/quota` | Receive quota assignments from Limes |

The `/v1/info` response is the contract. It tells Limes what you manage and what it can ask of you:

```go
liquid.ServiceInfo{
    Version: 1,
    Resources: map[liquid.ResourceName]liquid.ResourceInfo{
        "ca_instances": {
            HasQuota:    true,
            HasCapacity: false,   // we don't report HSM capacity
            Topology:    liquid.FlatTopology,
        },
    },
    Rates: map[liquid.RateName]liquid.RateInfo{
        "ca_created":            { HasUsage: true },
        "intermediate_ca_signed": { HasUsage: true },
        "ee_cert_signed":        { HasUsage: true },
    },
}
```

### Resources vs Rates

- **Resources** are things you can quota and have a current usage (e.g. `ca_instances` — how many CAs exist right now). These appear in billing and quota enforcement. `HasQuota: true` means Limes will send `PUT /quota` calls.
- **Rates** are billing counters — append-only measures of operations that happened (e.g. `ca_created`, `ee_cert_signed`). They are never limited, only measured. `HasUsage: true` means Limes will collect them in usage reports.

### PUT semantics

The LIQUID spec mandates `PUT` for quota assignment, but the actual behaviour is more like `PATCH` — only the resources listed in the request body are updated; others are left unchanged. This is intentional by the LIQUID spec and is confusing at first glance. We document it in the code with a comment.

### Path prefix

Our LIQUID endpoints live under `/liquid/v1/...`, not `/v1/...`. This matters because the service already has business API endpoints at `/v1/certificate-authorities` etc. Without a separate prefix, the routes would collide and it would be unclear which endpoints are for users vs billing infrastructure. The Keystone catalog URL includes the `/liquid` prefix, so Limes naturally appends `/v1/info` to get `/liquid/v1/info`.

### The bigger picture

LIQUID is a protocol used internally in our cloud, but the concept — a standardised "describe yourself, report your state, accept configuration" interface — is a common integration pattern in distributed systems. You see the same shape in:
- **Prometheus `/metrics`** — describe what metrics you export, report current values
- **Kubernetes admission webhooks** — standardised HTTP API for receiving configuration decisions
- **Envoy's xDS protocol** — standardised API for receiving routing/cluster configuration

The key design insight in all of these is that the consumer (Limes, Prometheus, Envoy) does not need to know anything about your internals — it just needs the standardised API surface. This makes it easy to add new services without changing the consumer.

**To learn more**: [go-api-declarations liquid package](https://pkg.go.dev/github.com/sapcc/go-api-declarations/liquid), [Limes documentation](https://github.com/sapcc/limes)

---

## OpenStack Seed: Registering in the Keystone Service Catalog

For Limes to find your LIQUID endpoint, it must be registered in the **Keystone service catalog**. The service catalog is OpenStack's service registry — a key-value store of service types to endpoint URLs, maintained by the Keystone identity service.

In our OpenStack cloud, this is managed via an `OpenstackSeed` Custom Resource in Helm:

```yaml
# helm-charts/my-service/templates/seed.yaml
spec:
  services:
    # Main API (used by end users)
    - name: my-service
      type: pca
      endpoints:
        - url: "https://my-service.{{ $region }}.{{ .Values.global.tld }}"

    # LIQUID endpoint (used by Limes only)
    # Naming convention: "liquid-{your_service_type}"
    - name: my-service-liquid
      type: liquid-pca
      endpoints:
        - url: "https://my-service.{{ $region }}.{{ .Values.global.tld }}/liquid"
```

The `OpenstackSeed` operator (a separate Kubernetes controller running in the cluster) reads these CRs and calls the Keystone API to create or update the service and endpoint records.

**The naming convention is critical**: Limes looks up services by constructing `"liquid-" + serviceType`. If your service is of type `pca`, Limes looks for `liquid-pca` in the catalog. Get this wrong and Limes gets a 404 from Keystone when resolving your URL.

### The bigger picture

The Keystone service catalog is OpenStack's analogue of DNS for services — a central directory that maps service types (abstract names) to endpoint URLs (concrete addresses). Clients look up "where is the compute service?" and get back the endpoint for that region.

The pattern of registering services in a central catalog is common in microservice architectures: Consul, Kubernetes Services (via DNS), AWS Service Discovery, and Eureka all solve the same problem. The key question is always the same: how does service B find service A without hardcoding the URL?

The `OpenstackSeed` operator is a GitOps-style solution: you declare the desired catalog state in a YAML file, commit it to git, deploy it with Helm, and the operator reconciles reality against the declaration. This is the Kubernetes operator pattern applied to OpenStack resources.

**To learn more**: [OpenStack Keystone service catalog](https://docs.openstack.org/keystone/latest/contributor/service-catalog.html), [Kubernetes operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)

---

## The Full Discovery Chain

Here is exactly how Limes discovers and talks to your service end-to-end. **Both steps are required** — missing either one means Limes cannot find the service.

```
Step 1: Your Helm chart (seed.yaml)
        └─ deploys OpenstackSeed CR
              └─ OpenstackSeed operator reconciles
                    └─ creates "liquid-pca" service + endpoint in Keystone
                          URL: https://my-service.region.tld/liquid

Step 2: Limes cluster config (secrets/limes/values.yaml)
        └─ lists "pca" under "liquids"
              liquids:
                pca:
                  area: security
        └─ regenerate → limes.yaml deployed to Limes pod

Step 3: Limes startup
        └─ for each key under "liquids", constructs service type:
              "liquid-" + key → "liquid-pca"
        └─ calls: liquidapi.NewClient(..., ServiceType: "liquid-pca")
        └─ gophercloud looks up "liquid-pca" in Keystone catalog
        └─ resolves endpoint: https://my-service.region.tld/liquid

Step 4: Limes scraping (periodic)
        └─ GET  https://my-service.region.tld/liquid/v1/info
        └─ POST https://my-service.region.tld/liquid/v1/report-capacity
        └─ POST https://my-service.region.tld/liquid/v1/projects/{id}/report-usage
        └─ PUT  https://my-service.region.tld/liquid/v1/projects/{id}/quota
```

**The gotcha that costs you a day**: The Keystone catalog registration (Step 1, in our repo) is necessary but not sufficient. Without Step 2 (the Limes config, in a different repo), Limes does not know `pca` exists and will never look it up. This is a cross-team dependency — whoever operates the Limes deployment must add the entry. A TODO comment in the code and a note in the PR description is the minimum required to not forget this.

### The bigger picture

This two-step discovery pattern — register with a directory service, AND configure the consumer — is more common than it looks. You see it in:
- **DNS + application config**: your service registers a DNS record, but the client also needs to have the hostname in its config
- **Prometheus**: a service exposes `/metrics`, but Prometheus also needs a `scrape_config` entry
- **Kafka**: a topic exists, but a consumer needs to be told which topic to subscribe to

In all these cases, the directory service (Keystone, DNS, Prometheus, Kafka) provides **resolution** (name → URL/address), but the consumer needs **registration** (explicit list of what to connect to). Auto-discovery (scanning the whole catalog for `liquid-*`) would be an alternative design but has scaling and security trade-offs.

---

## Helm Deployment: Tying It All Together

Helm is a package manager for Kubernetes. A Helm chart is a collection of templated YAML manifests — you provide values and Helm renders the final Kubernetes objects.

The Helm chart needs several pieces to be production-ready:

### 1. CRD Installation
The CRD YAML must be applied before the service starts (otherwise the client will fail to register the scheme):
```bash
kubectl apply -f config/crd/bases/myapp.example.com_projectquotas.yaml
```
In production, CRDs are typically placed in the `crds/` directory of the Helm chart, which Helm applies before any other resources.

### 2. RBAC
ServiceAccount + ClusterRole + ClusterRoleBinding granting the pod access to all required API groups:
- `myapp.example.com` — for issuers, cluster issuers, and now `projectquotas`
- `cert-manager.io` — for certificate requests

### 3. OpenstackSeed
Registers both the main API and the LIQUID endpoint in Keystone. Controlled by a feature flag (`openstackSeeds.enabled`) since it requires a live Keystone to be available and is not needed in development clusters.

### 4. Environment Variables
The service reads quota config via environment variables, which are set in the Helm `Deployment` template:
- `APP_NAMESPACE` — where to store quota CRDs
- `QUOTA_ENFORCEMENT_ENABLED` — feature flag (rate counting is always on; enforcement is optional)

Non-sensitive config comes from a `ConfigMap`, sensitive config (credentials) comes from a `Secret` via `valueFrom.secretKeyRef`.

### The bigger picture

Helm's value is that your entire deployment is **reproducible and version-controlled**. Every environment (dev, staging, prod) uses the same chart with different values files. Rolling back is `helm rollback`. Reviewing a change is `helm diff`.

The key Helm principle is that `values.yaml` is the public API of your chart — it is what operators configure. Internal template details are an implementation concern. Keep values.yaml clean and well-documented.

For CRDs specifically, Helm has a known limitation: if you update a CRD schema, `helm upgrade` does not automatically update the CRD (to avoid breaking existing resources). The standard practice is to put CRDs in `crds/` (Helm installs them but does not upgrade or delete them) or to manage CRD installation separately.

**To learn more**: [Helm documentation](https://helm.sh/docs/), [Helm chart best practices](https://helm.sh/docs/chart_best_practices/), [Managing CRDs with Helm](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/)

---

## REUSE Compliance: Licensing Auto-Generated Files

The [REUSE specification](https://reuse.software/) (from the Free Software Foundation Europe) defines a standard for machine-readable copyright and licensing information. The requirement is simple: every file must have an SPDX identifier. Most files get inline headers:

```go
// SPDX-FileCopyrightText: 2026 Your Company
// SPDX-License-Identifier: Apache-2.0
```

But auto-generated files (like our CRD YAML from `controller-gen` and the `zz_generated.deepcopy.go` file) present a problem: any inline headers get **overwritten** on regeneration.

The solution is `REUSE.toml` — a file that assigns copyright and license to files **externally**, using glob patterns:

```toml
[[annotations]]
path = ["config/crd/bases/**"]
SPDX-FileCopyrightText = "Your Company"
SPDX-License-Identifier = "Apache-2.0"
```

The `reuse lint` tool reads this and considers those files covered without needing inline headers. Using a glob (`**`) means any future CRDs added to that directory are automatically covered — you do not need to add a new annotation each time you add a CRD.

### The bigger picture

REUSE is part of the broader **SBOM** (Software Bill of Materials) movement — making it machine-readable which software components are in your product, under what licenses, and by whom. The EU Cyber Resilience Act (2024) and US Executive Order on Cybersecurity (2021) both push in this direction.

SPDX (Software Package Data Exchange) is the underlying standard. Every license has an SPDX identifier (e.g. `Apache-2.0`, `MIT`, `GPL-2.0-only`). Every file can have an SPDX `FileCopyrightText` and `LicenseInfoInFile` tag. Tools like `reuse`, `scancode`, and `fossology` parse these to generate license compliance reports.

The `reuse.toml` approach for generated files is the correct solution because code generation is explicitly accounted for in the REUSE spec — the tool understands that some files cannot carry inline headers.

**To learn more**: [REUSE specification](https://reuse.software/spec/), [SPDX specification](https://spdx.dev/), [reuse tool documentation](https://reuse.readthedocs.io/)

---

## Key Takeaways

1. **CRDs are a legitimate storage backend** for simple data at Kubernetes-native scale. You do not always need a database — evaluate whether etcd's constraints (small objects, key-based access) match your use case.

2. **SSA and Update serve different purposes** — SSA for multi-manager field ownership (different components writing to different fields), `Get` + `Update` for atomic read-modify-write. Never use SSA for incrementing counters.

3. **ResourceVersion is your optimistic lock** — it only works with `Update`, not with SSA. The retry loop is not optional; under concurrent load you will see conflicts.

4. **Maps in CRDs give extensibility** at the cost of compile-time safety. Use typed constants to compensate. Don't blindly apply "maps in CRDs are bad" — evaluate whether the concern (field ownership conflicts, unbounded growth) actually applies to your situation.

5. **Service discovery is a chain, not a single step** — Keystone catalog registration + consumer config + correct naming convention. Miss any link and it fails silently.

6. **The decorator pattern keeps concerns clean** — wrap an interface with another implementation of the same interface to add cross-cutting logic (quota, logging, tracing) without touching the business logic layer.

7. **Packages should reflect domain concepts, not technology** — `internal/quota/` for quota logic, not `internal/k8s/` just because it happens to use Kubernetes.

8. **Auto-generated files need special REUSE handling** — use `reuse.toml` annotations with glob patterns. Don't add inline headers that will be overwritten.

9. **RBAC is the most forgotten step** when adding CRDs. Always update the Helm RBAC template when adding a new resource type.

10. **Document cross-repo dependencies explicitly** — if your service requires a change in another repo (like a Limes config update), make that impossible to miss: TODO comment in code, note in PR description, issue in the dependent repo.

---

*Built while working on a PKI service in a large-scale OpenStack cloud. The code examples are from real production code.*
