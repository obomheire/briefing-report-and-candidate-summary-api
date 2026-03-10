# Notes

## Design Decisions

**Async summary generation is fire-and-forget after 202**
`POST /candidates/:id/summaries/generate` creates a `pending` summary record, enqueues the job, and returns `202 Accepted` before the LLM call starts. The worker runs in the same process using the in-memory `QueueService` from the starter. This is appropriate for the assessment scope — in production the worker would be a separate consumer (BullMQ, SQS, etc.) with retry semantics and dead-letter handling.

**`SummaryWorker` is a plain injectable service, not a queue consumer decorator**
The starter's `QueueService` is an in-memory queue with no built-in consumer dispatch. Rather than invent a decorator or polling loop that would complicate the codebase, the controller calls `worker.process()` directly via `void` (fire-and-forget) after enqueuing. The queue still holds the full audit trail of enqueued jobs. This keeps the separation of API vs. background logic intact without over-engineering the queue abstraction.

**Provider abstraction with runtime selection**
`LlmModule` wires `GeminiSummarizationProvider` when `GEMINI_API_KEY` is present and `FakeSummarizationProvider` otherwise. Both implement the same `SummarizationProvider` interface and are injected via the `SUMMARIZATION_PROVIDER` symbol token. Switching providers requires no code changes — only environment configuration. This also makes tests trivial: inject the fake, no mocking needed.

**Access control returns 403, not 404, for cross-workspace candidates**
Before any operation on a candidate's documents or summaries, the service checks that the candidate exists in `sample_candidates` with the requester's `workspaceId`. If not found, it returns `403 Forbidden` rather than `404 Not Found`. Returning 404 would leak whether a candidate ID exists at all, which is an information disclosure risk. 403 reveals nothing about other workspaces.

**Gemini output is validated before saving**
The `GeminiSummarizationProvider` strips markdown fences, parses JSON, and validates every field (`score` range, `strengths`/`concerns` as string arrays, `summary` non-empty, `recommendedDecision` in the allowed set). Any malformed output throws, which the worker catches and persists as a `failed` summary with `errorMessage`. This makes the system resilient to LLM drift or hallucination without crashing the worker.

**`SummaryWorker` never throws to the caller**
All errors inside `worker.process()` are caught, logged, and persisted as `status: 'failed'`. The controller uses `void` so an unhandled rejection would be silent — by catching everything inside the worker the status is always in a known terminal state (`completed` or `failed`).

---

## Schema Decisions

**`workspace_id` denormalized onto both tables**
Both `candidate_documents` and `candidate_summaries` store `workspace_id` alongside `candidate_id`. This allows efficient single-table workspace-scoped queries (`WHERE candidate_id = ? AND workspace_id = ?`) without joining `sample_candidates` on every read. The tradeoff is minor write redundancy, which is acceptable given that workspace membership is immutable once set.

**`strengths` and `concerns` stored as `jsonb`**
Both fields are string arrays from the LLM output. Storing them as `jsonb` avoids a separate junction table while keeping the data structured and queryable at the DB level. A plain `text` column with serialised JSON would lose type clarity at the ORM layer and make future querying harder.

**`score` stored as `numeric(5,2)`**
Preserves precision from the LLM output and avoids floating-point rounding issues. The LLM is prompted to return an integer 0–100, but the schema is intentionally permissive to handle fractional scores from future providers.

**`status` as `varchar(20)` with a TypeScript union type**
A DB-level `CHECK` constraint was not added — the `SummaryStatus` type (`'pending' | 'completed' | 'failed'`) enforces valid values at the application layer. A proper Postgres `ENUM` would be the right production choice but is harder to alter in migrations once deployed.

**Separate indexes on `candidate_id` and `workspace_id`**
Both columns are indexed independently on each table. `candidate_id` is the primary lookup key. `workspace_id` supports future workspace-level admin queries without requiring a join. The FK constraint on `candidate_id` enforces referential integrity with `sample_candidates`.

---

## What I Would Improve With More Time

**Replace the in-memory queue with a proper broker**
The starter's `QueueService` holds jobs in memory with no persistence, retry logic, or consumer dispatch. Replacing it with BullMQ (Redis-backed) would give durable job storage, automatic retries with backoff, dead-letter queues, and a clear API/worker process boundary.

**Dedicated worker process**
Currently the worker runs inside the same NestJS process as the API. Under load, a slow LLM call competes with HTTP request handling. A separate worker process consuming from the queue would isolate these concerns.

**Retry logic on transient LLM failures**
The worker marks a summary as `failed` on any error, including transient network issues or rate-limit responses. Adding a retry counter and exponential backoff before writing `failed` would make the system more resilient to temporary Gemini outages.

**Pagination on list endpoints**
`GET /candidates/:id/summaries` returns all summaries. Cursor-based or offset pagination would be needed in production where a candidate might accumulate many summary runs over time.

**Structured `promptVersion` management**
`promptVersion` is hardcoded to `'1.0'` in the worker. A config-driven version string would allow comparing outcomes across prompt iterations and rolling back if quality degrades.

**Rate limiting and cost controls**
Nothing prevents a recruiter from triggering hundreds of summary generations per minute. Middleware-level rate limiting per workspace (e.g. `@nestjs/throttler`) and a per-candidate cooldown would be important for production use and cost management.

**E2E tests with a real database**
Current tests are pure unit tests with mocked repositories. Adding an e2e suite using Testcontainers (Postgres) would catch migration correctness, constraint violations, and TypeORM query bugs that unit tests cannot surface.
