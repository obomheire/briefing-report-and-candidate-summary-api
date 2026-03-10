# Notes

## Design Decisions

**Single `briefing_points` table for key points and risks**
Rather than creating two separate tables (`briefing_key_points` and `briefing_risks`), both types share one table with a `point_type` discriminator column (`key_point` / `risk`). The structures are identical — an ordered text item belonging to a briefing — so splitting them would duplicate schema with no meaningful benefit. A `CHECK` constraint on `point_type` enforces valid values at the DB level.

**HTML stored on the `briefings` row, not re-rendered on read**
The generated HTML is persisted to a `html_content` column. `GET /briefings/{id}/html` returns the stored string — it does not re-render on every request. This means the report is a stable snapshot tied to the data at generation time. Re-calling `POST /briefings/{id}/generate` refreshes it. The alternative (rendering on every read) would be simpler but slower and non-deterministic if data were ever mutable.

**Two-step generate + fetch**
`POST /briefings/{id}/generate` and `GET /briefings/{id}/html` are kept as separate endpoints. Fetching HTML before generating returns a clear `409 Conflict`. This matches the spec and avoids silent side-effects on a GET request.

**Service layer owns all transformation logic**
The router (`briefings.py`) does nothing except call services and return responses. All business logic — building the view model, ordering items, normalising labels, stamping timestamps — lives in `briefing_service.py` and `briefing_formatter.py`. The Jinja2 template receives a fully prepared `BriefingReportViewModel` dataclass and does zero computation.

**Validation at two layers**
Pydantic schemas enforce all rules at the API boundary (uppercase ticker, min 2 key points, min 1 risk, unique metric names). The database enforces a subset independently (`CHECK (ticker = upper(ticker))`, `UNIQUE(briefing_id, name)` on metrics). API validation gives a clean structured error response; DB constraints are a safety net for any path that bypasses the API layer.

---

## Schema Decisions

**`display_order` column on points and metrics**
Insertion order is captured as an integer index at write time. This makes ordering deterministic and cheap to query — no need to rely on `id` or `created_at` ordering, which can be unreliable under concurrent inserts.

**`generated_at` as a nullable timestamp**
Storing an explicit `generated_at` timestamp alongside the boolean `is_generated` flag avoids inferring generation time from `updated_at`. It also allows future logic to detect stale reports — for example, comparing `generated_at` to `updated_at` if briefings ever become mutable.

**`briefing_points` unifies key points and risks**
Both share `(briefing_id, point_type, content, display_order)`. The `point_type` CHECK constraint (`'key_point'`, `'risk'`) ensures only valid types are stored. This was preferred over a DB enum type for portability — tests run on SQLite, which does not support native enums.

**Foreign keys with `ON DELETE CASCADE`**
`briefing_points` and `briefing_metrics` cascade-delete when the parent `briefing` row is deleted. This keeps the schema self-cleaning without requiring explicit application-level cleanup logic.

**Classic `Column(...)` declarations instead of `Mapped[X | None]`**
SQLAlchemy 2.0.36 does not support the `X | None` union annotation syntax under Python 3.14 due to a `Union.__getitem__` incompatibility introduced in that Python version. Classic `Column(...)` style declarations are functionally equivalent and work across all supported Python versions.

---

## What I Would Improve With More Time

**List endpoint with pagination**
A `GET /briefings` endpoint is missing. Adding it with cursor-based or offset pagination would make the API complete and useful in a real client.

**Report versioning**
Calling `POST /briefings/{id}/generate` currently overwrites the previous HTML. A `briefing_reports` table storing a history of generated snapshots would allow consumers to retrieve older versions and audit changes over time.

**Mutable briefings**
The current design treats a briefing as immutable after creation. A `PATCH /briefings/{id}` endpoint with proper child record diffing (e.g. upsert key points by position) would reflect real analyst workflows.

**PDF export**
HTML-only output limits usefulness in practice. Adding a PDF export via WeasyPrint or a headless browser (Playwright) would be a natural next step for a report-generation feature.

**Consistent error envelope**
FastAPI's default 422 validation responses are verbose and inconsistently shaped compared to 404/409 errors. A custom exception handler returning a uniform `{ "error": "...", "detail": [...] }` envelope would improve developer experience.

**Async database sessions**
The service uses synchronous SQLAlchemy with a thread pool. For higher throughput, migrating to `asyncpg` and SQLAlchemy's `AsyncSession` would eliminate blocking under load.

**Migration concurrency safety**
The custom migration runner does not acquire an advisory lock before applying migrations. Two service instances deploying simultaneously could attempt to apply the same migration concurrently. Adding `pg_try_advisory_lock` around the migration run would make it safe in multi-instance deployments.
