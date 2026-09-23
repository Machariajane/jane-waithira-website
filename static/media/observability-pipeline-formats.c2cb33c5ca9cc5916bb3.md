## Introduction

When building an observability platform on Kubernetes, you quickly run into a wall of confusing terminology. OTLP, gRPC, Protobuf, JSON, HTTP — what is actually what? If you have ever wondered why your application logs in JSON but you are parsing text strings, or what the real difference is between OTLP and gRPC, this post maps it out.

---

## The Three Layers: Wire, Transport, Schema

Every log pipeline stacks three distinct concepts. Mixing them up is the source of most confusion.

- **Wire Format** — what the bytes look like on disk or on the network. Raw text, JSON, CSV, compressed Protobuf.
- **Transport Protocol** — how those bytes travel between nodes. gRPC (over HTTP/2), HTTP REST, Kafka TCP.
- **Data Schema / Model** — the semantic contract defining what fields must exist. OTLP, for example, requires a `body`, `timeUnixNano`, and an `attributes` array.

OTLP is a *schema*. gRPC is a *transport*. Protobuf is a *wire format*. They are not interchangeable terms, and you pick one from each layer independently.

---

## Wire & Transport Format Reference

| Protocol / Format | Wire Format | Transport | Schema / Model | Primary Use Case |
|---|---|---|---|---|
| CRI Log Format | Space-delimited text | Local filesystem path | `[Timestamp] [Stream] [Tag] [Message]` | How Kubernetes nodes store raw container stdout to disk |
| JSON | Readable text string | Agnostic (any transport) | User-defined key-values | Standard structured application log format |
| OTLP/gRPC | Compressed binary Protobuf | gRPC over HTTP/2 | Strict OpenTelemetry spec | High-throughput, low-CPU telemetry streaming between agents |
| OTLP/HTTP | JSON text or Protobuf binary | Standard HTTP POST | Strict OpenTelemetry spec | Firewall-friendly fallback for OTLP |
| Kafka Native Protocol | Opaque byte array | Custom TCP (port 9092) | None — blind payload transport | High-speed decoupled stream buffering |
| Doris Stream Load | Flat JSON array or CSV | HTTP PUT | Relational columnar target | Bulk insertion into analytical databases |

---

## Inside the Binary: Raw vs Protobuf vs Avro

All three of these look like unreadable bytes on the wire — but they handle field identification and schema enforcement completely differently.

| Feature | Raw Binary | Protobuf Binary | Apache Avro Binary |
|---|---|---|---|
| What's inside? | Pure data bytes only | Data bytes + inline field tag numbers | Pure data bytes only (unless wrapped with a Schema ID) |
| How fields are found | Hardcoded byte offsets in application code | Read the field number embedded inline | Sequential position in an external schema definition |
| Schema requirement | Hardcoded logic in code | `.proto` files compiled to language classes | External JSON schemas (often via a Schema Registry) |
| Ideal use case | Raw hardware streams, native image/video | Microservices, RPCs, gRPC APIs | Kafka topics, Hadoop, long-term analytical archives |

### Raw Binary

The reader must know what the byte layout looks like ahead of time: "the first 4 bytes are an integer ID, the next 8 are a timestamp, the remainder is the message." Add a new field anywhere in that sequence and every reader breaks because the byte offsets shift.

### Protobuf Binary

Every field value is prepended with its field tag number from the `.proto` definition. Concretely: if your schema says `string user = 1;`, Protobuf writes the byte marker for tag `1` immediately before the encoded username. This means a consumer can safely skip fields it does not recognise — it reads the tag, sees an unknown number, and skips those bytes without crashing. Schema evolution (adding fields) is safe.

```proto
// log.proto
message LogEntry {
  string user    = 1;
  string level   = 2;
  int64  ts_unix = 3;
}
```

The serialised wire output is a compact binary blob, roughly: `0a 04 61 6c 65 78 12 04 69 6e 66 6f ...` — far smaller than the equivalent JSON.

### Apache Avro Binary

Avro writes fields sequentially in the exact order they appear in the schema — no field names or tag numbers embedded in the payload at all. This makes the binary extremely compact for bulk storage (write the JSON schema header once at the top of a file, then millions of rows of raw bytes). But the consumer *must* have the schema to decode anything. In Kafka pipelines, a Schema Registry embeds a 5-byte identifier at the front of each message so consumers can fetch the correct schema version.

```json
{
  "type": "record",
  "name": "LogEntry",
  "fields": [
    {"name": "user",    "type": "string"},
    {"name": "level",   "type": "string"},
    {"name": "ts_unix", "type": "long"}
  ]
}
```

Avro is the standard for Kafka-to-data-lake pipelines (Hadoop, Iceberg, Parquet-adjacent workflows) because the schema is managed centrally and the per-message overhead is near zero.

---

## Transport Independence: Any Wire Format Over Any Protocol

A common misconception: gRPC requires Protobuf, and HTTP only carries JSON. Neither is true.

### gRPC vs HTTP

gRPC uses HTTP/2 as its transport engine. The DATA frame in HTTP/2 carries an opaque byte sequence — it does not care what is inside.

- You can send Avro bytes over gRPC by declaring `bytes payload = 1;` in your `.proto` and serialising Avro on the client side.
- You can send JSON over gRPC by converting the string to bytes. (Rare in practice — it defeats the CPU efficiency of gRPC.)

The reason gRPC + Protobuf is the standard pairing is that gRPC tooling auto-generates clients and servers from `.proto` files, and a single multiplexed HTTP/2 connection streams binary frames continuously with microsecond latency. Sending Protobuf over plain HTTP/1.1 REST gets the compact binary but loses the connection multiplexing.

### Sending Different Wire Formats Over HTTP

HTTP is the universal transport. The `Content-Type` header signals which format is in the body.

```http
# JSON
POST /_bulk HTTP/1.1
Content-Type: application/json

{"level":"info","user":"alex"}

# Protobuf (this is what OTLP/HTTP does)
POST /v1/logs HTTP/1.1
Content-Type: application/x-protobuf

<binary protobuf bytes>

# Avro
POST /ingest HTTP/1.1
Content-Type: application/avro-binary

<binary avro bytes>
```

| Wire Format | Over gRPC? | Over HTTP? | Notes |
|---|---|---|---|
| Protobuf | Yes (native default) | Yes (OTLP/HTTP) | Optimised binary with inline tags |
| Avro | Yes (custom byte stream) | Yes (enterprise Kafka webhooks) | Opaque binary, needs schema registry |
| Raw Binary | Yes (video streaming) | Yes (file uploads) | Continuous raw byte stream |
| JSON | Yes (possible, inefficient) | Yes (standard web APIs) | Text-encoded, human readable |

---

## The OSI Model: Where Each Protocol Lives

The OSI (Open Systems Interconnection) model splits networking into 7 layers, each responsible for a different job. Every protocol in your observability pipeline sits at a specific layer. Understanding this stops you from mixing up what a protocol *does* with what layer it operates at.

| Layer | Name | Job | Examples in a log pipeline |
|---|---|---|---|
| 7 | Application | Defines the meaning of data — commands, schemas, semantics | HTTP, gRPC service definitions, OTLP, Kafka consumer protocol |
| 6 | Presentation | Encoding, encryption, compression | TLS/SSL encryption, Protobuf serialisation, gzip compression |
| 5 | Session | Manages connection sessions (open, maintain, close) | TLS handshake session, gRPC stream lifecycle |
| 4 | Transport | End-to-end delivery, port routing, reliability | TCP (reliable, ordered), UDP (fast, no guarantees) |
| 3 | Network | Routes packets across machines using IP addresses | IP routing between Kubernetes nodes, pods, and external endpoints |
| 2 | Data Link | Transfers frames between nodes on the same network segment | Ethernet frames, the container's virtual network interface |
| 1 | Physical | The actual bits on wire, fibre, or radio | NIC hardware, the physical cable, WiFi signal |

In practice, you interact with layers 4, 6, and 7 most often:

- When you choose **TCP vs UDP**, you are choosing layer 4 behaviour.
- When you choose **TLS**, you are adding layer 6 encryption.
- When you choose **HTTP vs gRPC**, and when you choose **JSON vs Protobuf**, you are making layer 7 and layer 6 decisions respectively.

The lower layers (1–3) are handled by the kernel and infrastructure — you do not configure them directly unless you are debugging a network partition or setting up Kubernetes NetworkPolicies.

### Where Your Pipeline Protocols Sit

```
L7 Application  │ HTTP REST, gRPC service, OTLP schema, Kafka consumer protocol
L6 Presentation │ Protobuf binary, Avro binary, JSON text, TLS encryption, gzip
L5 Session      │ TLS handshake, gRPC stream, HTTP keep-alive
L4 Transport    │ TCP (Kafka :9092, OpenSearch :9200, PG :5432), UDP (some metrics)
L3 Network      │ IP routing between pods / nodes
L2 Data Link    │ Virtual Ethernet (veth pairs in K8s)
L1 Physical     │ NIC / cable / cloud fabric
```

A single OTel Agent → OpenSearch write crosses all seven layers: the Protobuf bytes (L6) are wrapped in an HTTP POST (L7), delivered over a TLS session (L5/L6), transported by TCP (L4), routed by IP (L3), across virtual Ethernet (L2), over the physical host NIC (L1).

---

## TCP vs HTTP: Not Competitors, Different Layers

TCP and HTTP do not compete. HTTP runs *on top of* TCP.

- **TCP (Layer 4 — Transport)** connects two computers, manages ports, detects lost packets, and retransmits them in order. It does not know what your data means. It sees bytes.
- **HTTP (Layer 7 — Application)** defines semantic meaning: `GET`, `POST`, status codes, headers, cookies. It gives instructions meaning.

The handshake when a log collector writes to a database:

1. **TCP steps in first.** The OS opens a socket to port 9200. TCP sends SYN/ACK flags. A reliable byte pipe is established.
2. **HTTP steps in second.** Over that pipe, the collector sends:
   ```http
   POST /_bulk HTTP/1.1
   Host: opensearch.local
   Content-Type: application/json
   ```
3. **TCP finishes the job.** It chops the HTTP request into binary chunks, sends them, confirms receipt, and reassembles them at the destination.

| Feature | TCP | HTTP |
|---|---|---|
| Network layer | Layer 4 (Transport) | Layer 7 (Application) |
| Job | Connect machines, fix lost packets, order bytes | Define intent: fetch, insert, update |
| Data visibility | Blind — sees raw binary bytes only | Structured — reads headers, status codes, tokens |
| Lifespan | Stateful persistent socket | Stateless request-response cycles |

gRPC sidesteps the overhead of opening a new TCP connection per request by multiplexing many streams over a single long-lived HTTP/2 connection. That is the core performance advantage over standard HTTP/1.1 REST.

---

## What Actually Happens to a Log Line in Kubernetes

When your application prints `{"level":"info", "user":"alex"}` inside a container, it does not hit a database. The path is:

1. The Container Runtime Interface (containerd) intercepts stdout.
2. It wraps your JSON string in a CRI envelope and writes it to the host node at `/var/log/pods/<namespace>_<pod>_<uid>/<container>/0.log`.

The file on disk looks like this:

```
2026-09-23T14:50:00.123456789Z stdout F {"level":"info", "user":"alex"}
```

Your application wrote JSON. Kubernetes stored text. That is the first format shift in the pipeline.

---

## Three Pipeline Architectures

Target databases do not natively understand OTLP's nested data structures. You need an architecture to bridge the gap. The examples below use OpenSearch, Apache Doris, and PostgreSQL as target stores — each consumes logs differently.

### Scenario 1: Asynchronous (Kafka Buffer) → OpenSearch

```
App → OTel Agent (DaemonSet) → OTel Gateway → Kafka → Data Prepper → OpenSearch

[Node Disk (CRI text)] → [OTel Agent] --(gRPC/Protobuf)--> [OTel Gateway] --(Kafka TCP)--> [Kafka] → [Data Prepper] --(HTTP Bulk)--> [OpenSearch]
```

Best for enterprise scale. Kafka absorbs traffic spikes and decouples producer throughput from consumer speed.

- The OTel Agent DaemonSet tails `/var/log/pods`, strips CRI metadata with `regex_parser`, and merges application fields into the OTel attributes array.
- It keeps a long-lived gRPC connection to stream binary Protobuf to a central OTel Gateway, which writes the bytes directly into a Kafka topic.
- **How OpenSearch consumes it:** Kafka treats the payload as a blind byte stream. Data Prepper runs as a Kafka consumer group, decodes the Protobuf back to JSON, aggregates records into batches, and writes via the HTTP `_bulk` API. OpenSearch receives a flat JSON array and indexes each document into an inverted index for full-text search.

```json
// What Data Prepper sends to OpenSearch
POST /_bulk
[
  {"index": {"_index": "logs-2026.09.23"}},
  {"timestamp": "2026-09-23T14:50:00Z", "level": "info", "user": "alex", "message": "login"}
]
```

### Scenario 2: Queue-Less Direct Gateway → Apache Doris

```
App → OTel Agent (DaemonSet) → OTel Gateway → Apache Doris

[Node Disk (CRI text)] → [OTel Agent] --(gRPC/Protobuf)--> [OTel Gateway] --(HTTP PUT Stream Load)--> [Apache Doris]
```

For sub-second analytical query latency without managing Kafka.

- The OTel Agent DaemonSet ships over persistent OTLP/gRPC.
- The central OTel Gateway batches in RAM until a capacity limit is met.
- **How Doris consumes it:** The native `dorisexporter` flattens the nested OTLP schema into tabular columns and sends them via HTTP PUT Stream Load. Doris receives a flat JSON array or CSV, writes it to a columnar storage engine (optimised for `SELECT ... WHERE level='error'` aggregations), and acknowledges the load transaction.

```bash
# What the OTel Gateway sends to Doris
curl -X PUT "http://doris-fe:8030/api/logs_db/app_logs/_stream_load" \
  -H "Content-Type: application/json" \
  --data-binary '[
    {"ts": "2026-09-23T14:50:00Z", "level": "info", "user": "alex"}
  ]'
```

### Scenario 3: Direct Agent Fleet → PostgreSQL

```
App → OTel Agent (DaemonSet) → PostgreSQL

[Node Disk (CRI text)] → [OTel Agent] --(OTLP/HTTP or SQL over TCP)--> [PostgreSQL]
```

PostgreSQL is not a native observability store, but it is a valid target for lower-volume structured logs where you want SQL query flexibility over raw log data.

- **How PostgreSQL consumes it:** PostgreSQL has no native OTLP receiver. You have two options:
  1. Use a collector with a `postgresql` exporter that writes via standard SQL `INSERT` over TCP port 5432.
  2. Use the OTel Collector's `otlphttpexporter` to send to a middleware (like a small Go service) that translates OTLP payloads into `INSERT INTO logs (ts, level, user, message) VALUES (...)` statements.

```sql
-- Target table
CREATE TABLE app_logs (
  ts        TIMESTAMPTZ NOT NULL,
  level     TEXT,
  pod       TEXT,
  namespace TEXT,
  message   TEXT,
  attrs     JSONB
);

-- The agent or middleware inserts via standard TCP connection
INSERT INTO app_logs (ts, level, pod, message)
VALUES ('2026-09-23T14:50:00Z', 'info', 'api-7d9f', 'login');
```

**Trade-off:** PostgreSQL stores rows in a heap — great for transactional workloads, poor for time-series aggregations at high ingest rates. For serious observability volume (millions of log lines per minute), TimescaleDB (a PostgreSQL extension) or a dedicated columnar store (Doris, ClickHouse) is a better fit. PostgreSQL makes sense when log volume is modest and you want `JOIN logs WITH users` SQL queries.

### Scenario 4: Edge-Parser Fleet (Vector DaemonSet) → Apache Doris

```
App → Vector (DaemonSet) → Apache Doris

[Node Disk (CRI text)] → [Vector DaemonSet] --(HTTP PUT Stream Load)--> [Apache Doris]
```

Minimal operational footprint — no gateway tier.

- Vector runs on each node, reads raw log files, strips the CRI wrapper, flattens nested JSON, and batches records.
- It writes directly from the node to Doris via Stream Load over standard HTTP.

**Warning:** Node performance becomes tied to database health. If Doris slows down, Vector's local buffers backpressure and can saturate node disk during sustained degradation.

---

## Non-Distributed: When Everything is on One Server

If your application, log agent, and database all live on the same machine, the entire network layer collapses.

```
[ App Process ] → [ Local Log File ] → [ Local Agent ] → [ Local Database ]
```

No gRPC. No OTLP. No Kafka. The agent reads the file and writes to localhost.

| Component | Distributed | Non-Distributed |
|---|---|---|
| Network journey | Node → Gateway → Kafka → Consumer → DB | Disk → Agent memory → localhost DB |
| Transport | gRPC (HTTP/2) + Kafka TCP | Loopback HTTP or Unix socket |
| Wire format | Compressed binary Protobuf | Plain JSON text |
| Schema | Nested OTLP spec | Flat user-defined fields |
| Failure buffer | Multi-node Kafka cluster | Local disk/RAM queue |

This model hits two hard ceilings at scale: resource contention (agent, app, and DB share the same CPU/RAM) and a single point of failure (disk fills or node dies, everything stops at once).

---

## Rule of Thumb

Use **gRPC + Protobuf** between processing nodes to minimize CPU. Add a **Kafka queue** to absorb traffic spikes and decouple failure domains. Do the final **Protobuf → JSON/SQL conversion** at the consumer layer, immediately before writing to your target database. Choose **OpenSearch** for full-text log search, **Doris/ClickHouse** for analytical aggregations at high ingest rates, and **PostgreSQL** only when log volume is low and SQL join queries across your existing data matter more than ingest throughput.

---

## Resources

- [OpenTelemetry Protocol Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OTel Collector Documentation](https://opentelemetry.io/docs/collector/)
- [Protocol Buffers Documentation](https://protobuf.dev/)
- [Apache Avro Documentation](https://avro.apache.org/docs/)
- [Apache Doris Stream Load](https://doris.apache.org/docs/data-operate/import/import-way/stream-load-manual)
- [Vector Documentation](https://vector.dev/docs/)
- [OpenSearch Data Prepper](https://opensearch.org/docs/latest/data-prepper/)
- [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/index.html)
