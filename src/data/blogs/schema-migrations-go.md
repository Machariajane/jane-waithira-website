## Introduction

A schema migration is a single, versioned change to a database schema. Migration tooling tracks which changes have been applied, applies the pending ones, and rolls them back where reversible. Without it, DDL is applied by hand — not repeatable, not versioned, not safe in CI/CD.

This post covers the mental model, the patterns, and the mechanics. Reference material, not a recommendation.

---

## The anatomy of a migration

A migration is a pair of operations: **up** (apply the change) and **down** (reverse it). Each has a **version** — a timestamp or sequence number that defines ordering. A tracking table in the database records which versions have been applied.

```
20261001120000_create_users.up.sql     → CREATE TABLE users ...
20261001120000_create_users.down.sql   → DROP TABLE users
```

Three concepts to keep separate:

| Concept | What it is |
|---|---|
| Migration **file** | The SQL (or Go code) defining one change |
| Migration **version** | The identifier used for ordering and tracking |
| **Applied state** | The row in the tracking table saying "this version ran successfully" |

---

## Versioning: timestamps vs sequential numbers

Two conventions:

**Sequential numbers** — `001_create_users.sql`, `002_add_email.sql`.
Easy to read, but two developers on separate branches can both create `003_*` and collide at merge.

**Timestamps** — `20261006143022_create_users.sql`.
Collision-free across branches. Harder to eyeball at a glance.

Timestamps are the dominant convention now. Most tools support both. **Use UTC** — a developer's skewed local clock can make a migration land "before" one that was actually written earlier. Not catastrophic (apply order is by sort), but worth stating as a convention.

Tool CLIs usually stamp the current UTC time for you so you never type the version by hand:

```bash
goose create add_record_id sql
# → 20261006150412_add_record_id.sql
```

---

## The up/down pair

```sql
-- 20261006143022_create_users.up.sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE
);

-- 20261006143022_create_users.down.sql
DROP TABLE users;
```

**`up` is mandatory. `down` is conventional.** Not every change is reversibly expressible — a column dropped and refilled can't be restored without the original data. Teams often skip `down` for destructive changes and only use `down` in development.

In production, `down` is rarely run. Rollback usually means forward-fix (apply a corrective `up` migration) rather than reverse.

---

## The tracking table

Every tool creates a table in the target database to record state. The schema varies but the shape is similar:

```sql
-- Goose
CREATE TABLE goose_db_version (
    id SERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL,
    is_applied BOOLEAN NOT NULL,
    tstamp TIMESTAMP DEFAULT NOW()
);

-- golang-migrate
CREATE TABLE schema_migrations (
    version BIGINT NOT NULL PRIMARY KEY,
    dirty BOOLEAN NOT NULL
);
```

**The tracking table lives in the same database as the schema it tracks.** Not external, not a config file. If you clone a database, you clone its migration history.

---

## Three patterns for running migrations

### Pattern 1 — Separate step before the application starts

```
┌──────────────┐   completes   ┌──────────────┐
│   migrator   │ ────────────> │  application │
│   (Job/CLI)  │               │  (Deployment)│
└──────────────┘               └──────────────┘
```

A dedicated process applies migrations. Only when it exits successfully does the application start.

Typical deployment forms:
- Kubernetes **Job** fired by a Helm `pre-upgrade` hook
- CI/CD **step** that runs the migrator CLI against the target DB before deploying
- An **init container** in the application pod

**Credential split**: migrator holds DDL privileges; application holds only runtime privileges.

### Pattern 2 — At application startup, inside `main()`

```go
func main() {
    db := open(dsn)
    goose.Up(db, "migrations")   // apply pending migrations
    serveHTTP(db)
}
```

Same binary, same credentials. One pod, one deploy.

Simple, but every pod running startup migrations needs DDL privileges — and if the application has multiple replicas, they race. Tools provide advisory locks to serialise them (where the database supports it).

### Pattern 3 — One binary, two subcommands

```bash
myapp migrate up      # subcommand A
myapp serve           # subcommand B
```

Same image, different arguments. The Job runs `myapp migrate up`; the Deployment runs `myapp serve`. Combines pattern 1's safety with the convenience of a single artifact.

---

## Where migration files live at runtime

### Embedded in the binary (`embed.FS`)

Go 1.16+ lets you bake files into the compiled binary:

```go
import "embed"

//go:embed migrations/*.sql
var migrations embed.FS
```

The compiler reads matching files at build time and includes them as read-only bytes. `migrations` behaves like a tiny read-only filesystem — you read files from it, list directories — but all content is in-memory bytes from the binary.

**Trade-offs:**

| | |
|---|---|
| Binary and migration set are inseparable | One deployment artifact, cannot drift |
| No disk mount, no ConfigMap, no file copying | Simpler Kubernetes manifests |
| Air-gap friendly | One image to vendor, nothing extra to ship |
| Rebuild required to add migrations | True of any binary change |
| Binary grows with migration count | SQL is tiny — hundreds of files add <1 MB |

**When to revisit:** only if integration-test startup becomes slow enough that replaying all migrations hurts developer flow, in which case flatten the oldest migrations into a single init file.

### Loaded from disk at runtime

Migrations shipped as separate files, read by the tool at startup:

```bash
goose -dir ./migrations postgres "$DSN" up
```

**Trade-offs:**

| | |
|---|---|
| Can inspect SQL on the running pod | Easier to debug in place |
| Can patch a migration without rebuilding | Dangerous — also easier to drift |
| Need a mechanism to get files onto the pod | ConfigMap, volume mount, image layer |

### Baked into a dedicated migration Docker image

A separate `Dockerfile.migrate` that copies the SQL files into a container:

```dockerfile
FROM alpine
COPY migrations/ /migrations/
COPY --from=builder /goose /usr/local/bin/
ENTRYPOINT ["goose", "-dir", "/migrations"]
```

Mechanically identical to embedding — the image is the atomic unit instead of the binary.

---

## Credential separation

Migrations need DDL (`ALTER`, `CREATE`, `DROP`). The application only needs runtime privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE` — or, for append-only stores, just `INSERT`).

Two accounts, same database:

```sql
CREATE USER app_migrator WITH PASSWORD '...';
GRANT ALL PRIVILEGES ON SCHEMA public TO app_migrator;

CREATE USER app_runtime WITH PASSWORD '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
```

The migrator runs under `app_migrator` and disappears after the migration. The application runs under `app_runtime` with no DDL authority. A compromised application pod can't drop tables.

Pattern 1 maps naturally to credential separation. Pattern 2 forces the application to hold DDL privileges all the time.

---

## Concurrency and locking

If multiple processes could run migrations against the same database at the same time, you need coordination.

**PostgreSQL** has advisory locks:
```sql
SELECT pg_advisory_lock(12345);  -- blocks until acquired
```

**MySQL** has `GET_LOCK`:
```sql
SELECT GET_LOCK('migrator', 10);
```

**OLAP engines on the MySQL wire protocol (Doris, ClickHouse), SQLite, and many others** have no cross-process lock primitive at all.

Migration tools expose this differently:
- **golang-migrate** calls `pg_advisory_lock` or `GET_LOCK` internally, non-configurable
- **Goose** has a `SessionLocker` interface, off by default, opt-in via `WithSessionLocker()`
- **dbmate** has no application-level lock — relies on per-migration transactions

If your deployment pattern guarantees only one migrator at a time (pattern 1 with a Kubernetes Job), the lock is unnecessary. If you run migrations in `main()` with multiple replicas, you need one — and if the database doesn't offer one, pattern 2 isn't safe.

---

## Failure recovery models

Migrations fail. The question is what the tool does afterwards.

**golang-migrate uses a dirty flag.** Before each migration it marks the version `dirty = true`. If the migration fails, the flag persists and no further migrations run until an operator inspects the database and runs:

```bash
migrate force <version>
```

The reasoning: a failed migration might have left the schema in an inconsistent partial state. A human should look before the pipeline continues.

**Goose, dbmate, and others don't set a dirty flag.** A failed migration just doesn't advance the tracking table. Fix the SQL, redeploy, the tool retries from the last successful version.

Neither is wrong. The dirty-flag model prioritises caution; the no-flag model prioritises automation. The right choice depends on how your deployment pipeline handles failures — if the pipeline already stops rolling on migration failure (Helm's `pre-upgrade` hook does this), the dirty flag adds a second gate that may or may not be useful.

### How you know a migration failed (Goose)

Three independent signals:

**1. Exit code and error output** — synchronous, immediate:
```
2026/10/06 15:04:12 FAIL 20261006123000_create_traces.sql (3.2ms):
    failed to run SQL migration: executing statement:
    ERROR 1064 (42000): Syntax error near 'DISTRIBUT BY RANDOM'
exit status 1
```

**2. The tracking table** — persistent, inspectable at any time:
```bash
$ goose status
    Applied At                  Migration
    ========================================
    Mon Oct  6 15:04:12 2026 -- 20261006120000_create_logs.sql
    Mon Oct  6 15:04:12 2026 -- 20261006121500_create_metrics.sql
    Pending                  -- 20261006123000_create_traces.sql
```
A failed migration shows as `Pending`. Goose doesn't record failed attempts — just the last success.

**3. The deployment platform's view** — Helm hook failure, Kubernetes Job status, pipeline alert.

Alerting isn't a Goose feature. Goose exits with a non-zero code; the deployment platform (Argo CD, Prometheus on `kube_job_status_failed`, CI pipeline notifications) raises the alert.

### Standard recovery flow

```
1. helm upgrade → fails on pre-upgrade hook
2. kubectl logs job/migrate-N  → read the error
3. Fix the .sql file in the repo, PR, review, merge
4. CI publishes a new migrator image
5. helm upgrade → runs Job again, picks up from last successful
                  version, tries the fixed migration
6. Success → Deployment rolls → service starts on new version
```

No manual intervention in the database. The tracking table state is correct — it just reflects "the fix hadn't been merged yet."

---

## Transactions

Most tools wrap each migration in a database transaction so a partial failure rolls back automatically. **How well this works depends on the database.**

| Database | DDL in transactions? | What this means |
|---|---|---|
| PostgreSQL | ✅ Yes | Multi-statement DDL in one migration is atomic — a failure rolls back the lot |
| MySQL / Doris (MySQL wire protocol) | ⚠️ No | DDL commits implicitly per statement. The transaction wrapper is cosmetic. |
| SQL Server | Partial | Some DDL transactional, some not |
| ClickHouse | ❌ No | No DDL transactions at all |

**For PostgreSQL**, write multi-statement migrations freely and trust the tool's implicit transaction.

**For MySQL-protocol databases**, assume a failed migration can leave the schema half-changed. Mitigations:

- **One logical change per migration file** — smallest possible blast radius
- **Idempotent DDL** where supported — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **Short migrations** — fewer statements, less to recover from

Some DDL cannot run inside a transaction even where transactions exist. PostgreSQL's `CREATE INDEX CONCURRENTLY`, for example, must run outside a transaction. Tools provide per-migration opt-outs:

```sql
-- +goose Up
-- +goose NO TRANSACTION
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

---

## Backups before migrations

Taking a database snapshot before a schema-changing deploy is a standard safety net — but it's **not universal advice**. It depends on the data's value and the restore cost.

| Store characteristic | Snapshot before migrations? |
|---|---|
| Small, authoritative (operational database, catalogue) | **Yes.** Snapshot is cheap, restore is realistic. |
| Multi-TB analytical store with retention windows | **Usually no.** Snapshot is slow and expensive; forward-fix is faster than restore. |
| Source of truth with no upstream re-ingestion | **Yes, always.** |
| Materialised from an upstream pipeline | **Often no.** Re-ingest is the recovery path. |

For a database you can snapshot cheaply, the pattern is:

```
1. Snapshot (and verify the snapshot completed)
2. Apply migration via Helm pre-upgrade hook
3. If anything goes wrong, restore from snapshot
```

For a database you can't snapshot cheaply, lean on:
- Smaller migrations (less to roll back)
- Idempotent DDL (safe to retry)
- Backward-compatible rollouts (old code still works if the migration half-applies)
- Upstream re-ingestion as the ultimate recovery

---

## Go-ecosystem tools, at a glance

| Tool | Format | Style | Driver support |
|---|---|---|---|
| **golang-migrate** | `.up.sql` / `.down.sql` pairs | Imperative, timestamped | 20+ databases bundled |
| **Goose** | Single SQL file with `-- +goose Up/Down` | Imperative, SQL + Go migrations | 10+ databases, build-tag trimming |
| **Atlas** | HCL or SQL schema file | Declarative (compute diff) or imperative | 7+ databases |
| **dbmate** | Single SQL file with `-- migrate:up/down` | Imperative, CLI-first | 5 databases |
| **sql-migrate** | Single SQL file with `-- +migrate Up/Down` | Imperative | 5 databases |
| **tern** | Single SQL file with Go-template support | Imperative, PostgreSQL-only | PostgreSQL |

**Imperative** = you write the SQL for each change.
**Declarative** = you write the target schema; the tool generates the SQL diff.

### Library vs CLI

Most Go-ecosystem tools ship as a single module exposing both a library and a CLI:

| Use | Form |
|---|---|
| Production migrator in a Kubernetes Job | **Library** — `provider.Up(ctx)` from a dedicated `cmd/migrator/main.go` |
| Readiness probe in the service binary | **Library** — read-only `goose.GetDBVersion()` on startup |
| Developer scaffolding and local runs | **CLI** — installed via `go install` or `brew` |
| CI integration tests | Either |

### Build-tag trimming

Tools that bundle multiple drivers often expose exclusion tags to drop the ones you don't need. For Goose:

```bash
go build -tags='no_postgres no_sqlite3 no_mssql no_clickhouse no_libsql no_vertica no_ydb' \
  -o migrator ./cmd/migrator
```

Keeps MySQL only. Reduces image size, eliminates cgo requirements (SQLite needs cgo), narrows the vulnerability-scan surface. The convention is exclusion-based (`no_*`) rather than inclusion-based, so a developer who adds nothing gets a working CLI with every driver — safe default.

---

## Imperative vs declarative

**Imperative (versioned):**
- You write every change by hand
- Migration history is the sequence of changes
- Review happens on the SQL you wrote
- Reproducible: same inputs → same database state

**Declarative (schema-as-code):**
- You write the target schema once
- The tool computes the diff from current state to target
- Review happens on the generated migration
- The target schema file is the source of truth, migrations are derived

Imperative is older and more widespread. Declarative is newer; Atlas is the main Go-ecosystem example.

Declarative tools need to **understand** the DDL they generate, which means parser coverage limits what databases and features they support. Non-standard DDL extensions (partitioning schemes, custom types, engine-specific properties) may not be representable in the declarative language.

---

## The CI/CD pattern

Three places migrations fit into a pipeline:

**1. On every pull request.**
A throwaway database (`testcontainers-go` is the Go-ecosystem default) is spun up, migrations apply, integration tests run. Catches broken migrations before merge.

**2. On deployment.**
The migrator step runs before the application rolls. In Kubernetes with Helm, this is a `pre-upgrade` hook Job. In other setups it's a CI pipeline step.

**3. In the application itself (pattern 2 only).**
Migrations run on startup. CI tests verify they apply cleanly; production applies them when a new pod starts.

---

## Testing migrations

Three kinds of test are worth having:

**Does the migration apply cleanly?**
Spin up an empty database, run all migrations in order, assert the end state matches expectations. Fastest to write.

**Is the migration reversible?**
Apply up, apply down, apply up again — the schema should match. Only possible if you write `down` migrations.

**Does the data survive the migration?**
For data-affecting migrations: seed representative data, run the migration, assert the data is still queryable in the new shape. Hardest to write but catches silent data loss.

---

## Readiness checks

A nuance pattern 1 enables: the application can **read** the applied version and refuse to start if the schema isn't current.

```go
func main() {
    db := open(dsn)

    expected := int64(20261006123000)   // compiled into the binary
    actual, _ := goose.GetDBVersion(db)
    if actual < expected {
        log.Fatalf("schema at %d, expected ≥ %d", actual, expected)
    }

    serveHTTP(db)
}
```

The application never writes to the tracking table — only reads. If the Job failed or wasn't run, the application fails fast rather than running against the wrong schema.

Three ways to set `expected`:
- **Manual constant per release** — explicit, obvious at review time, drifts if forgotten
- **Build-time generation from the highest migration file** — automatic, works for most changes, breaks if the migration order is non-monotonic
- **Range check** — accept any version in a tested range, useful for backward-compatible rolling updates

---

## Immutability

**Applied migrations are immutable.** Once a migration has been applied in any shared environment (CI, staging, production, a teammate's dev DB), editing its SQL creates drift between environments that have the old version and those that have the new.

Correct a mistake with a new migration, not by editing the old one. Tools don't enforce this — it's convention — but every team learns it the hard way at least once.

---

## When migration counts grow

Three signals that a growing migration history is costing something:

**Integration tests slow down.**
Replaying 500 migrations against a throwaway database on every test run adds minutes. The common fix is to **flatten** the oldest N migrations into a single `000001_init.sql` that creates the current state of those tables, delete the originals, and mark the init migration as the new baseline.

**Binary growth from embedding.**
Rarely a real problem. SQL files are tiny; hundreds of them add <1 MB. If you see real growth, check whether migrations are embedding seed data (CSV, JSON, large INSERT blocks) rather than just DDL.

**Rebuild time.**
`go build` reads the migration files but doesn't compile them. If builds slow down, it's almost always because the Go code changed, not because migrations grew.

---

## How often migrations run — and what that implies for the DDL

Mature services don't migrate often. Once a quarter in steady state is normal; once a month during active development; weekly only during a redesign. Several forces push toward rarity:

- Each migration is a maintenance window with human review
- A schema that uses VARIANT (or JSON columns) for everything non-essential absorbs most additions without DDL
- Retention windows mean that promoting a path to a static column later is cheap — new rows populate, old rows carry NULL, retention cycles them out

**The DDL should be designed assuming migrations are rare**, which translates to five practical shapes:

**Favour additive, nullable columns.** `ALTER TABLE t ADD COLUMN new_field TYPE NULL` is metadata-only on most modern databases. Tightening to `NOT NULL` later is a separate migration after the writing code is deployed.

**Design for ADD COLUMN being metadata-only.** Doris's `light_schema_change = true`, PostgreSQL 11+'s support for constant-default columns, PostgreSQL 16's support for volatile defaults — all mean adding a column to a large table is now cheap. Don't over-column up front; expand later when evidence demands it.

**Know which changes rewrite the table and which don't.** `ADD COLUMN NULL` is cheap; `MODIFY COLUMN TYPE` often isn't; partition / sort key / bucket changes are *not an ALTER* on OLAP engines — they're a new-table-plus-backfill project. One-way doors deserve the review budget; everything else can be fixed later.

**Keep migrations short and composed.** One logical change per file. Long-running changes (backfills, large index builds) belong in background jobs that don't gate the deploy.

**Backward-compatible rollouts.** Add column → deploy code that writes it → deploy code that reads it → tighten the constraint. Each step is deployable in isolation; a rollback at any step is safe.

---

## Idioms worth knowing

**One file per logical change.** Don't batch unrelated changes into one migration — hard to review, hard to roll back.

**Backward-compatible changes first.** Add new columns as nullable, deploy the code that reads them, then make them required in a later migration. Avoids the all-or-nothing deploy.

**Column drops are two migrations.** First: stop writing to the column (code change). Second: drop the column (migration). Dropping a column that code still writes to is an outage.

**Index creation online.** For PostgreSQL, `CREATE INDEX CONCURRENTLY`. For MySQL, `ALGORITHM=INPLACE, LOCK=NONE`. These avoid table locks on write-heavy tables.

**Keep migrations fast.** A migration that takes 20 minutes blocks every deployment. For long-running data changes (backfills, large index builds), consider a separate background job that doesn't gate the release.

**Comment the why in the file itself.** Six months later, the migration file is where someone will look for context — the commit message is harder to find. Explain intent above each block, not what the SQL does.

**Operate on the right tool for the job.** The service binary and the migrator should typically be separate programs with different credentials, even when they ship from the same repository.

---

## Reference reading

- **golang-migrate** — https://github.com/golang-migrate/migrate
- **Goose** — https://github.com/pressly/goose
- **Atlas** — https://atlasgo.io/
- **dbmate** — https://github.com/amacneil/dbmate
- **Flyway (Java equivalent)** — https://flywaydb.org/
- **Alembic (Python equivalent)** — https://alembic.sqlalchemy.org/
- **`embed.FS` documentation** — https://pkg.go.dev/embed
