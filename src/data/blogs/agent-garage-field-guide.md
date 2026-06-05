## Introduction

This is a deep-dive into everything I learned while building a production multi-agent system on Google Cloud — a reasoning agent deployed on Vertex AI Agent Engine, fronted by a FastAPI adapter on Cloud Run, with RAG, SSE streaming, enterprise chat integration, and full CI/CD.

The project touched almost every layer of a modern AI application: agent orchestration frameworks, LLM provider abstraction, vector search, streaming protocols, secrets management, observability, and deployment pipelines. Each piece had its own lessons.

---

## Table of Contents

1. [The Architecture: Why Two Services?](#the-architecture-why-two-services)
2. [Google Agent Development Kit (ADK)](#google-agent-development-kit-adk)
3. [LiteLLM and the LLM Proxy Pattern](#litellm-and-the-llm-proxy-pattern)
4. [Multi-Agent Orchestration: Root + Sub-Agents](#multi-agent-orchestration-root--sub-agents)
5. [RAG: Retrieval-Augmented Generation in Practice](#rag-retrieval-augmented-generation-in-practice)
6. [SSE Streaming and the A2A Protocol](#sse-streaming-and-the-a2a-protocol)
7. [Enterprise Chat Integration: Capabilities and Routing](#enterprise-chat-integration-capabilities-and-routing)
8. [CI/CD with GitHub Actions](#cicd-with-github-actions)
9. [Observability: OpenTelemetry, Cloud Logging, Cloud Trace](#observability-opentelemetry-cloud-logging-cloud-trace)
10. [Secrets, Service Keys, and IAM Patterns](#secrets-service-keys-and-iam-patterns)
11. [The gcloud CLI: What I Actually Use](#the-gcloud-cli-what-i-actually-use)
12. [Testing Strategy: Unit, Eval, Integration](#testing-strategy-unit-eval-integration)
13. [Debugging Methodology](#debugging-methodology)
14. [Key Takeaways](#key-takeaways)

---

## The Architecture: Why Two Services?

The system is a **multi-agent onboarding consultant** — it walks users through scoping and planning a new AI agent. It exposes three endpoints:

- `/ask` — synchronous JSON response
- `/stream` — Server-Sent Events for real-time streaming
- `/.well-known/agent.json` — A2A protocol discovery

These endpoints are served by a **FastAPI Cloud Run service** (the adapter). Behind it, the actual reasoning happens in a **Vertex AI Agent Engine deployment** (the brain).

```
[ Chat UI ]
    | JSON-RPC (A2A protocol)
    v
[ Cloud Run: FastAPI adapter ]
    | stream_query()
    v
[ Vertex AI Agent Engine: root agent ]
    | AgentTool routing
    |-- oracle_agent    (RAG over documentation)
    |-- roi_agent       (cost modelling, token pricing)
    |-- ethics_agent    (DPIA, GDPR, Responsible AI)
         |
         v
    [ LLM Provider ] <-- LiteLLM proxy --> Claude Sonnet
    [ Vector Store ] <-- vector search for RAG
```

Why not run everything in one service? Because Agent Engine and Cloud Run are good at different things:

| Agent Engine is good at | Cloud Run is good at |
|---|---|
| Running ADK agents with managed sessions | Custom HTTP routes and streaming |
| Tool execution and state persistence | JWT validation and custom auth |
| Deployment versioning | A2A protocol envelopes |

Agent Engine has a fixed API — you cannot add custom routes to it. Cloud Run is stateless — it cannot maintain agent sessions across requests. So Agent Engine hosts the brain, Cloud Run hosts the mouth. The adapter calls `agent_engines.get(...).stream_query(...)` for each user turn.

### The bigger picture

This is the **Backend for Frontend (BFF)** pattern applied to AI agents. The Cloud Run adapter is a BFF: it translates between what the frontend expects (SSE, A2A protocol) and what the backend provides (Agent Engine's fixed API). You see the same pattern in mobile apps (GraphQL gateway → microservices) and SPA frontends (API gateway → internal services).

The key design insight: draw your boundaries at protocol translation points. Where the protocol changes (A2A → Agent Engine SDK), that is where a new service belongs.

**To learn more**: [Anthropic's "Building effective agents"](https://www.anthropic.com/engineering/building-effective-agents), [Cloud Run documentation](https://cloud.google.com/run/docs)

---

## Google Agent Development Kit (ADK)

ADK is Google's Python framework for building LLM agents. The core abstractions:

| Abstraction | What it does | When to use |
|---|---|---|
| `LlmAgent` | An agent backed by a model with a system prompt and tools | Default choice for any reasoning agent |
| `SequentialAgent` | Runs sub-agents in fixed order | Pipelines where each step's output feeds the next |
| `ParallelAgent` | Fans out to sub-agents concurrently | Independent retrievals |
| `LoopAgent` | Re-runs a sub-agent until a condition is met | Iterative refinement |
| `tools=[...]` | Python functions exposed to the model | Database lookups, API calls, deterministic logic |
| `sub_agents=[...]` | Other LlmAgents the parent can route to (AgentTool) | Multi-agent orchestration |
| `output_key` | Writes the agent's final response to session state | Hand off context between phases |

The critical concept is `output_key`. When `roi_agent` finishes, it writes its result to `output_key="phase2_roi_summary"` in session state. The root agent can then read this on the next turn. Without `output_key`, you re-derive everything from raw chat history every turn — slow and lossy.

Tool functions need clean docstrings AND clean type hints. ADK turns the docstring + type hints into the tool schema the LLM sees. A vague docstring produces vague tool calls. This is not optional: the model literally reads your docstring to decide whether to call the tool.

Sub-agent descriptions drive routing. When the root has `sub_agents=[oracle, roi, ethics]`, the LLM picks one based on each sub-agent's `description` field. Vague descriptions produce wrong routing. The fix is always to edit the sub-agent description — not the root prompt.

### The bigger picture

ADK sits in the same category as LangGraph, CrewAI, and AutoGen — orchestration frameworks for LLM agents. They all solve the same core problem: managing the event loop (call model → parse response → execute tool → call model again) and providing state management between turns.

The differentiator for ADK is its tight integration with Vertex AI Agent Engine for deployment. The same agent definition you develop locally can be deployed to Agent Engine with `agent_engines.create(...)` without changing the code. This is similar to how Flask apps deploy to App Engine — the framework and the runtime are designed together.

**To learn more**: [ADK documentation](https://google.github.io/adk-docs/), [ADK source on GitHub](https://github.com/google/adk-python)

---

## LiteLLM and the LLM Proxy Pattern

**LiteLLM** is a Python library that gives 100+ LLM providers a single OpenAI-compatible interface. ADK uses it under the hood whenever the model is not Gemini.

In enterprise environments, you often cannot call Anthropic or OpenAI directly — you go through an internal proxy that handles auth, billing, and rate limiting. The model identifier uses a provider prefix:

```python
from google.adk.models.lite_llm import LiteLlm
_model = LiteLlm(model="custom_provider/anthropic--claude-4.5-sonnet", max_tokens=8192)
```

The prefix tells LiteLLM which provider config to use. It then resolves to the underlying model behind the enterprise gateway.

The `max_tokens` parameter is critical and non-obvious. If you don't set it, LiteLLM uses a low default (1024 in many configs). When the agent synthesises a long document, it silently truncates the response and emits **zero text parts** to the streaming adapter. The end user sees a hang with no error. This was our most time-consuming bug — a 200 OK response with an empty body, caused by a missing parameter three layers deep.

Auth follows the "ambient credentials" pattern — a JSON service key with `clientid`, `clientsecret`, `auth_url`, and `serviceurls` is loaded from environment variables at process start. Every LLM call uses these credentials automatically. If they are missing, the error message is cryptic (`APIConnectionError: No credentials found in any source`) because the failure happens deep in the provider's auth layer, not at the point where you made the call.

### The bigger picture

The proxy pattern here is identical to what you see in database connection pooling (PgBouncer in front of PostgreSQL), API gateways (Kong, Envoy in front of microservices), and CDNs (Cloudflare in front of origin servers). The proxy adds a concern (auth, billing, caching, rate limiting) without the client needing to change its code.

The "ambient credentials" pattern is the same as Application Default Credentials (ADC) in GCP, or the AWS credential chain. The idea: configure auth once at the environment level, and every library in the process inherits it automatically. This is clean for production but confusing for local development and testing, where the credentials may not be set.

**To learn more**: [LiteLLM custom providers](https://docs.litellm.ai/docs/providers/custom_llm_server), [OAuth client-credentials flow (RFC 6749)](https://tools.ietf.org/html/rfc6749#section-4.4)

---

## Multi-Agent Orchestration: Root + Sub-Agents

Three styles of multi-agent orchestration exist in ADK:

| Style | Mechanism | When to use |
|---|---|---|
| **Hierarchical** | Root agent has `sub_agents=[...]`; ADK exposes them as `AgentTool` | When the root needs to dynamically choose which specialist to call |
| **Sequential pipeline** | `SequentialAgent` with ordered steps | When the flow is always Phase 1 → Phase 2 → Phase 3 |
| **Tool-only** | Sub-agents wrapped as Python functions calling `runner.run` | When you need maximum control over execution |

We use hierarchical. The root agent's job is *routing* — it reads the user message, decides which sub-agent is relevant, and delegates. Each sub-agent is a full `LlmAgent` with its own model, system prompt, and tools. The root's instruction explicitly lists each sub-agent and when to use it — without that, the LLM has no context for why `ethics_advisor` exists.

Sub-agents share session state via `output_key`. That is how the root sees `phase2_roi_summary` and `phase3_ethics_summary` when synthesising the final document.

The most impactful architectural decision was splitting one 400-line prompt into three sub-agents with focused prompts of < 100 lines each. Before the split: the model got confused at deep conversation turns, forgot earlier context, and contradicted itself. After the split: 90% of hallucinations disappeared. Each sub-agent has a narrow job and a short prompt. The root coordinates without carrying domain-specific knowledge.

### The bigger picture

This is the same trade-off as microservices vs monoliths — smaller, focused units vs one large unit. The advantage of splitting is clear separation of concerns and independent iteration (you can fix the ethics agent's prompt without touching ROI). The cost is coordination complexity (state passing via `output_key`, routing via descriptions).

Anthropic describes this as the "orchestrator-workers" pattern: one agent decides what to do, specialised agents do the work. An alternative is the "evaluator-optimizer" pattern where one agent generates and another critiques. The right topology depends on the problem.

**To learn more**: [Anthropic's multi-agent patterns](https://www.anthropic.com/engineering/building-effective-agents), [LangGraph state management](https://langchain-ai.github.io/langgraph/)

---

## RAG: Retrieval-Augmented Generation in Practice

The system has two RAG layers:

**Layer 1 — Ingestion pipeline** (runs as a GitHub Action on docs change):
- Walks a documentation directory for `.md` files
- Chunks them (~1000 tokens per chunk, 100-token overlap)
- Pushes chunks into a vector store collection

**Layer 2 — Runtime retrieval** (a tool function the agent calls at query time):
- Resolves the collection by **title** (not ID)
- Calls the vector search endpoint with the user's query
- Returns top-K chunks to the agent

The title-based resolution is a critical design choice. When the ingestion job runs again, it creates a *new* collection with a new ID — but the title stays the same. Title-based resolution at query time means the agent always finds the latest collection without a code change or redeploy.

The retrieval tool also handles stale-cache 404s: if the cached collection ID returns a 404 (because the collection was recreated), it re-resolves by title and retries once. Without this, every re-ingest of documentation required a code change.

Chunking parameters matter more than you would expect. Too small (200 tokens) and each chunk lacks sufficient context for the model to use it. Too large (4000 tokens) and retrieval precision drops — you waste tokens on irrelevant paragraphs. The 1000/100 split (chunk size / overlap) was found by iterating on retrieval quality with test queries.

A subtle failure mode: the RAG retrieves documents about Topic A, and the model uses that information to make claims about the user's Topic B. The fix is prompt rules that explicitly scope RAG: "retrieved documents are for framework lookups only — do NOT use them to substitute facts about the user's specific context."

### The bigger picture

RAG is a specific application of the retrieve-then-generate pattern used in information retrieval since before LLMs existed. The pipeline (ingest → chunk → embed → store → query → retrieve → generate) is the same shape as a search engine pipeline (crawl → index → query → rank → display). The embedding model replaces the inverted index; the LLM replaces the snippet generator.

Production RAG systems usually have two retrieval stages: an embedding model for initial recall (find 50 candidate chunks) and a reranker model for precision (score and filter down to 5). We only use the first stage — adding a reranker is a clear next step for quality improvement.

**To learn more**: [Pinecone RAG guide](https://www.pinecone.io/learn/retrieval-augmented-generation/), [LlamaIndex documentation](https://docs.llamaindex.ai/)

---

## SSE Streaming and the A2A Protocol

**Server-Sent Events (SSE)** is a one-way HTTP streaming protocol — the server pushes events to the client over a single long-lived connection:

```
data: {"text": "Hello"}\n\n
data: {"text": " world"}\n\n
```

In FastAPI, this is implemented with `StreamingResponse` and an async generator. We use an `asyncio.Queue` between the agent's event loop (which produces events) and the SSE generator (which serialises and sends them). The queue also allows the generator to emit heartbeat pings during long LLM calls — keeping the connection alive and giving the user feedback.

The **Agent-to-Agent (A2A) JSON-RPC protocol** defines the event structure that chat frontends expect:

| Event | Purpose |
|---|---|
| `TaskStatusUpdateEvent` | Intermediate status (working, processing) |
| `TaskArtifactUpdateEvent` | A piece of generated content (text chunk) |
| `TaskCompletedEvent` | Final artifact, conversation complete |

Three bugs that shipped to production and how they were fixed:

**1. Heartbeat text leaking into chat.** The heartbeat messages ("Still processing...") and real content both used the same `text` field. The frontend concatenated them. Fix: heartbeats use a separate event type with no `text` field; only real content chunks set `text`.

**2. Empty response as silent failure.** If the agent emitted zero text parts (due to `max_tokens` truncation), the stream ended cleanly — 200 OK, connection closed normally. The user saw a spinner that never resolved. Fix: track a `text_emitted` boolean. At stream close, if it is still `False`, emit a fallback message explaining that the response was empty.

**3. Post-mortem without visibility.** When silent failures happened, there was no way to know what events the agent *did* produce. Fix: log an `event_tally` at stream end — a count by event type (e.g. `model:function_call: 3, model:text: 0`). This immediately shows whether the model called tools but produced no text.

### The bigger picture

SSE is one of three options for server-to-client push:

| Protocol | Direction | Use when |
|---|---|---|
| **SSE** | Server → Client only | Streaming text/events (chat, logs, notifications) |
| **WebSockets** | Bidirectional | Real-time collaboration, gaming, multiplayer |
| **Long polling** | Simulated push via repeated requests | Legacy fallback when SSE/WS unavailable |

SSE has built-in reconnection semantics (the browser auto-reconnects with the `Last-Event-ID` header), which WebSockets does not. For unidirectional streaming like chat responses, SSE is simpler and more resilient than WebSockets.

The `asyncio.Queue` pattern (producer/consumer with backpressure) is the standard approach for decoupling event production from event consumption in async Python. The same pattern appears in logging pipelines, message brokers, and actor systems.

**To learn more**: [SSE specification](https://html.spec.whatwg.org/multipage/server-sent-events.html), [FastAPI StreamingResponse docs](https://fastapi.tiangolo.com/advanced/custom-response/)

---

## Enterprise Chat Integration: Capabilities and Routing

To plug a custom agent into an enterprise chat platform, you publish a **capability** — a configuration bundle that tells the platform when to route user messages to your agent and how to call it.

Routing works via semantic similarity:

1. User types a message.
2. The platform's **preselector** runs vector similarity over every registered scenario's `description` field.
3. The top-scoring match wins — unless confidence is below a threshold, in which case the platform falls back to its built-in LLM ("Direct Response").

The consequence: if your scenario `description` does not cover phrases the user is likely to type, you lose the routing competition to Direct Response — which can hallucinate answers because it knows nothing about your actual agent.

Two bugs that surfaced:

**1. Hallucinated capabilities.** A user asked "does the system have something similar?" — this did not match our scenario description closely enough, so it routed to Direct Response, which fabricated agent names. Fix: explicitly include discovery phrases in the scenario description ("does it already have...", "is there an existing solution for...").

**2. Config drift between source and deployed.** A scenario was renamed in the source repo but never re-deployed to the platform. Users were hitting the old scenario. Lesson: source-controlled config is the spec, but the **deployed** config is what users actually hit. Always verify what is live — not what is in git.

### The bigger picture

This routing mechanism is an intent classifier implemented as a retrieval problem. Each scenario description is a candidate, the user message is the query, and the preselector does nearest-neighbour search in embedding space. This is the same architecture as FAQ-matching bots and customer support routing systems.

The failure mode (low confidence → fallback to generic LLM) is a deliberate design choice: it ensures the user always gets *some* response, even when no capability matches. But it creates a new problem — the generic LLM can hallucinate in your domain. Mitigations include: broadening scenario descriptions, adding negative routing rules, and having the generic LLM disclaim when it lacks knowledge.

**To learn more**: [Intent classification with embeddings](https://huggingface.co/tasks/text-classification), [Retrieval-based chatbot routing patterns](https://arxiv.org/abs/2005.11401)

---

## CI/CD with GitHub Actions

The project has multiple deployment workflows (agent deploy, adapter deploy, RAG ingestion, integration tests, security scanning). The patterns that matter:

**Self-hosted runners are not `ubuntu-latest`.** Organizations often use custom runner pools with specific labels. Workflows that say `runs-on: ubuntu-latest` get stuck "queued" indefinitely if there is no GitHub-hosted runner allocation for the org. Always check the org convention for runner labels.

**A failed test job does not equal a failed deploy.** If the deploy workflow runs test and deploy jobs in parallel, the deploy can succeed while tests fail. The runtime artifact is live. This is either a feature (deploy is not blocked by flaky tests) or a bug (broken code reaches production). Decide explicitly — make the deploy job `needs: [test]` if you want the gate, leave them independent if you don't.

**Workload Identity Federation over service account keys.** Putting a GCP service account JSON in a GitHub secret works, but WIF (GitHub Actions auths to GCP via OIDC token exchange) is more secure — no long-lived credentials to rotate, no key files to leak. Worth migrating to.

A workflow anatomy:

```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: [self-hosted]
    permissions:
      id-token: write              # required for WIF
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ...
      - run: gcloud run deploy ...
```

### The bigger picture

The "queued forever" failure is a specific instance of a broader class of CI problems: **implicit environment assumptions**. The workflow YAML says `ubuntu-latest` but the runtime environment does not provide it. The same class of bug appears when CI assumes a specific Python version, a specific package registry, or a specific network route. The fix is always the same: make the assumption explicit and validated (check runner labels, pin versions, test connectivity).

The parallel test/deploy pattern is a form of **optimistic CI** — deploy and hope the tests pass, roll back if they don't. This is appropriate for non-critical services with good rollback mechanisms. For production services where a bad deploy is expensive, pessimistic CI (deploy only after tests pass) is safer.

**To learn more**: [GitHub Actions documentation](https://docs.github.com/en/actions), [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)

---

## Observability: OpenTelemetry, Cloud Logging, Cloud Trace

The adapter and agent are instrumented with **OpenTelemetry** for distributed tracing.

| Concept | What it is |
|---|---|
| **Span** | A unit of work with start time, end time, and attributes |
| **Trace** | A tree of spans linked by parent-child IDs |
| **Context propagation** | The trace ID travels across HTTP calls so the call graph survives service hops |
| **Exporter** | Where spans go — Cloud Trace, Jaeger, OTLP collector |

What we trace:
- HTTP request in (FastAPI middleware)
- Each ADK agent turn (`runner.run`)
- Each tool call (custom span)
- Outbound LLM call (LiteLLM auto-instrumented)
- Outbound RAG call

Logs and traces are different things that complement each other. Logs are flat events ("at 14:03:22, tool X returned error Y"). Traces are structured timelines ("this request took 4.2s total: 200ms in routing, 3.8s waiting for the LLM, 200ms in RAG retrieval"). Cloud Logging holds the logs; Cloud Trace holds the traces. They are linked via `trace_id` — you can go from a log line to the full trace of the request that produced it.

The hardest part is **attribute hygiene**. If your spans do not carry `user_id`, `session_id`, `agent_name`, `tool_name` attributes, you cannot filter when something breaks in production. These attributes must be added at the source (where the span is created), not after the fact. Sampling also matters at scale: 100% trace sampling is expensive. The standard production pattern is 100% on errors, 1-10% on success.

### The bigger picture

OpenTelemetry is the convergence of two older projects (OpenTracing and OpenCensus) into a single standard for observability instrumentation. It defines three signals: traces, metrics, and logs. The key value proposition is **vendor neutrality** — you instrument once with OTel, then export to any backend (Datadog, Grafana, Cloud Trace, Jaeger) by changing the exporter config.

The mental model for distributed tracing is a **call graph with timing**. In a monolith, you get this from a profiler. In a distributed system, you need context propagation (passing trace IDs in HTTP headers) to stitch the graph back together across service boundaries.

**To learn more**: [OpenTelemetry documentation](https://opentelemetry.io/docs/), [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)

---

## Secrets, Service Keys, and IAM Patterns

Secrets live in three places in this project:

1. **Service key JSON** at repo root — gitignored locally, mounted as a Secret Manager secret in deployed environments
2. **GitHub Actions secrets** — LLM provider credentials and GCP credentials for CI
3. **Cloud Run runtime env vars** — set via `gcloud run deploy --set-secrets`

The rules:

**Never paste a secret into chat, a PR description, or a commit message.** Even if you delete it immediately, platforms cache content in logs, notifications, and search indexes. Treat any exposed credential as compromised and rotate immediately. There is no "probably fine" — the cost of rotation is low, the cost of a breach is high.

**Service-key bindings can be shared across team members.** A service key might be owned by a colleague. Deleting it breaks their workflows. Always create your own personal binding rather than touching shared ones.

**Principle of least privilege.** The Cloud Run service account needs `aiplatform.user` and `secretmanager.secretAccessor` — not `editor`. The broader the permissions, the larger the blast radius if the credentials are compromised.

**Rotation cadence.** Production secrets should rotate at least quarterly. Personal dev keys should rotate whenever a teammate leaves the project. Automate rotation where possible (Secret Manager supports automatic rotation policies).

### The bigger picture

The "ambient credentials" pattern (env vars read at process start) is universal across cloud platforms: GCP uses Application Default Credentials, AWS uses the credential provider chain, Azure uses DefaultAzureCredential. They all follow the same priority order: explicit config → environment variable → metadata service → failure.

Workload Identity Federation (WIF) replaces long-lived service account keys with short-lived tokens obtained via OIDC federation. GitHub Actions presents its OIDC token to GCP, GCP validates it and issues a short-lived access token. No key files, no rotation burden, no risk of leaked JSON files. This is the direction all cloud providers are moving.

**To learn more**: [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation), [Secret Manager rotation](https://cloud.google.com/secret-manager/docs/rotation-recommendations)

---

## The gcloud CLI: What I Actually Use

The commands I run weekly:

```bash
# Auth
gcloud auth login
gcloud auth application-default login          # for SDKs that look for ADC
gcloud config set project PROJECT_ID
gcloud config set account me@example.com

# Cloud Run
gcloud run services list --region=us-central1
gcloud run services describe SERVICE --region=us-central1
gcloud run services logs read SERVICE --region=us-central1 --limit=200
gcloud run deploy SERVICE --source=. --region=us-central1

# Vertex AI Agent Engine (via Python; no first-class CLI)
# python -c "from vertexai import agent_engines; print([a.name for a in agent_engines.list()])"

# IAM
gcloud projects get-iam-policy PROJECT_ID
gcloud iam service-accounts list

# Secrets
gcloud secrets list
gcloud secrets versions access latest --secret=SECRET_NAME

# Logs / traces
gcloud logging read 'resource.type=cloud_run_revision' --limit=50 --format=json
gcloud trace traces list --limit=10
```

Two flags that save time:
- `--format=json` then pipe to `jq` — structured output you can filter and transform
- `--quiet` in scripts — suppresses interactive prompts that break automation

For managing multiple projects, `gcloud config configurations` lets you switch between named profiles (`gcloud config configurations activate dev`). This avoids the common mistake of deploying to the wrong project because you forgot which account is active.

**To learn more**: [gcloud CLI reference](https://cloud.google.com/sdk/gcloud/reference), [gcloud config configurations](https://cloud.google.com/sdk/gcloud/reference/config/configurations)

---

## Testing Strategy: Unit, Eval, Integration

Three test layers, each verifying a different thing:

| Layer | What it verifies | Tool | Needs real LLM? |
|---|---|---|---|
| **Unit tests** | Pure Python functions (cost calc, chunkers, parsers) | `pytest` | No |
| **Agent evals** | The agent's behaviour on fixed scenarios | ADK's `EvalSet` framework | Yes |
| **Integration tests** | The deployed service actually responds | Custom HTTP smoke tests | No (hits deployed endpoint) |

Agent evals are the layer most people skip and most regret skipping. You cannot unit-test "the LLM gives a good answer." What you can do:
- Define a **scenario**: fixed input messages + expected tool calls + response constraints
- Run the agent against it with a real (cheap) model
- Score: did it call the right tool? Did the answer mention required facts?

ADK's eval framework reads JSON eval sets and executes them. They require real LLM credentials, which is why the test job fails in environments without credentials configured.

**Don't mock the LLM in evals.** Mocked LLMs pass tests that real models would fail — you are testing your mock, not your agent. Use a real model (the cheapest one that is representative).

**Integration tests should be tiny but real.** One smoke test — "POST `/ask` → 200 → response body contains expected keyword" — catches 80% of deployment regressions. It verifies the entire chain: Cloud Run is up, it can reach Agent Engine, Agent Engine can call the LLM, the response is formatted correctly.

**Test outcomes, not prompts.** Asserting "response contains exact string X" is fragile — the model rephrases on every run. Asserting "response correctly classifies according to a rubric" is robust.

### The bigger picture

The three-tier pattern mirrors the test pyramid in traditional software (unit → integration → e2e). The unique addition for AI systems is the **eval layer** — testing non-deterministic behaviour requires statistical thinking (pass rate over N runs) rather than binary pass/fail.

Eval-driven development (writing evals before changing prompts) is emerging as the AI equivalent of test-driven development. The discipline is the same: define what correct looks like before you implement it.

**To learn more**: [Anthropic's eval cookbook](https://github.com/anthropics/anthropic-cookbook), [Braintrust eval framework](https://www.braintrust.dev/)

---

## Debugging Methodology

This is the meta-skill that compounded the most. The loop:

1. **Reproduce.** If I cannot make it happen on demand, I cannot fix it.
2. **Trace the actual path.** Logs first, then traces, then code. Do not guess.
3. **Find the lowest layer where reality diverges from expectation.** That is the bug.
4. **Read errors bottom-up.** The deepest stack frame is usually the closest to the root cause.
5. **Fix the cause, not the symptom.** "Add a try/except" is a symptom fix. Finding *why* the exception happens is the real fix.

Three examples from this project:

**Silent response failure.** Symptom: 200 OK, blank response. Layer 1 (HTTP): clean. Layer 2 (SSE): zero text frames sent. Layer 3 (agent events): zero `TextPart` events emitted. Layer 4 (LLM call): response truncated by `max_tokens` default. Fix applied at Layer 4 — set `max_tokens=8192`.

**Chat platform hallucination.** Symptom: fabricated agent names in response. Layer 1 (response text): clearly from the platform's generic LLM, not our agent. Layer 2 (routing): our scenario did not win the similarity match. Layer 3 (scenario description): too narrow, did not cover the user's phrasing. Fix applied at Layer 3 — broadened the description.

**Stuck CI workflow.** Symptom: workflow queued indefinitely, never starts. Layer 1 (workflow YAML): `runs-on: ubuntu-latest`. Layer 2 (org runner config): no GitHub-hosted runner allocation exists. Fix applied at Layer 1 — changed to the org's runner label.

### The bigger picture

This loop is a formalisation of the **scientific method** applied to debugging: observe (reproduce), hypothesise (which layer?), test (trace), conclude (fix the divergence point). The "bottom-up stack reading" heuristic works because exceptions propagate upward — the original failure is always at the bottom, with each layer adding context on top.

The hardest debugging skill is *not guessing*. The instinct is to hypothesise immediately and start changing code. The discipline is to trace first — read the actual logs, look at the actual request, check the actual config. Most bugs become obvious once you see what actually happened instead of what you assumed happened.

**To learn more**: [Julia Evans' debugging zines](https://wizardzines.com/), [How to Debug by John Regehr](https://blog.regehr.org/archives/199)

---

## Key Takeaways

1. **Draw service boundaries at protocol translation points.** Where the protocol changes (A2A → Agent Engine SDK), that is where a new service belongs. The adapter pattern gives you a stable HTTP surface independent of the backend runtime.

2. **`output_key` is how ADK agents share state.** Without it, every turn re-derives context from raw chat history. With it, each sub-agent writes a summary that subsequent agents can read directly.

3. **`max_tokens` is not optional.** Silent truncation produces zero text events, which produces blank responses with a 200 OK status. Always set it explicitly.

4. **Title-based resource resolution beats ID-based** for any system where resources are recreated on ingest. Use stable names that survive recreation.

5. **Split large prompts into sub-agents.** A 400-line prompt confuses the model at deep conversation turns. Three 100-line prompts with clear routing descriptions eliminated 90% of hallucinations.

6. **Heartbeats and content must use separate event types** in streaming protocols. Mixing them in the same field causes the frontend to concatenate heartbeats into the response.

7. **Track `text_emitted` to detect silent stream failures.** A stream that closes cleanly with zero content is a failure — emit a fallback message.

8. **Scenario descriptions drive chat routing.** If your description does not cover the user's phrasing, you lose to the generic LLM. Broaden descriptions to include discovery and alternative phrasings.

9. **Use Workload Identity Federation, not service account keys.** Short-lived tokens via OIDC federation eliminate the risk of leaked credential files.

10. **Agent evals are not optional.** You cannot unit-test LLM behaviour. Define scenarios with expected outcomes, run against real models, measure pass rate.

11. **Debug by tracing, not by guessing.** Read the actual logs. Find the lowest layer where reality diverged from expectation. That is where the fix belongs.

12. **Ambient credentials fail silently.** If env vars are missing, the error appears deep in the framework — not at the point of misconfiguration. When tests fail with cryptic errors, check credentials first.

---

*Built while shipping a multi-agent system on Google Cloud with Vertex AI Agent Engine, Cloud Run, and ADK. The lessons are from real production bugs and real code reviews.*

