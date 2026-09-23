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

OpenSearch, Apache Doris, and similar databases do not natively understand OTLP's nested data structures. You need an architecture to bridge the gap.

### Scenario 1: Asynchronous (Kafka Buffer)

```
Pipeline: App → OTel Agent (DaemonSet) → OTel Gateway → Kafka → Data Prepper → OpenSearch

[Node Disk (CRI text)] → [OTel Agent] → gRPC/Protobuf → [OTel Gateway] → Kafka TCP → [Kafka] → [Data Prepper] → HTTP Bulk → [OpenSearch]
```

Best for enterprise scale. Kafka absorbs traffic spikes and decouples producer throughput from consumer speed.

- The OTel Agent DaemonSet tails `/var/log/pods`, strips CRI metadata with `regex_parser`, and merges application fields into the OTel attributes array.
- It keeps a long-lived gRPC connection to stream binary Protobuf to a central OTel Gateway, which writes the bytes directly into a Kafka topic.
- Kafka treats the payload as a blind byte stream. Data Prepper consumes it, decodes Protobuf back to JSON, batches the records, and writes to OpenSearch via the HTTP `_bulk` API.

### Scenario 2: Queue-Less Direct Gateway

```
Pipeline: App → OTel Agent (DaemonSet) → OTel Gateway → Apache Doris

[Node Disk (CRI text)] → [OTel Agent] → gRPC/Protobuf → [OTel Gateway] → HTTP PUT Stream Load → [Apache Doris]
```

For sub-second query latency without managing Kafka.

- The OTel Agent DaemonSet ships over persistent OTLP/gRPC.
- The central OTel Gateway batches in RAM. When capacity is met, the native `dorisexporter` maps nested OTLP schemas down to flat tabular records and sends them via HTTP PUT Stream Load.

### Scenario 3: Edge-Parser Fleet (Vector DaemonSet)

```
Pipeline: App → Vector (DaemonSet) → Apache Doris

[Node Disk (CRI text)] → [Vector DaemonSet] → HTTP PUT Stream Load → [Apache Doris]
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

Use **gRPC + Protobuf** between processing nodes to minimize CPU. Add a **Kafka queue** to absorb traffic spikes and decouple failure domains. Do the final **Protobuf → JSON conversion** at the consumer layer, immediately before writing to your target database.

---

## Resources

- [OpenTelemetry Protocol Specification](https://opentelemetry.io/docs/specs/otlp/)
- [OTel Collector Documentation](https://opentelemetry.io/docs/collector/)
- [Apache Doris Stream Load](https://doris.apache.org/docs/data-operate/import/import-way/stream-load-manual)
- [Vector Documentation](https://vector.dev/docs/)
- [OpenSearch Data Prepper](https://opensearch.org/docs/latest/data-prepper/)
