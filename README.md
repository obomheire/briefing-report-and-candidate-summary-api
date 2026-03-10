# Backend Engineering Assessment Starter

This repository is a standalone starter for the backend engineering take-home assessment.
It contains two independent services in a shared mono-repo:

- `python-service/` (InsightOps): FastAPI + SQLAlchemy + manual SQL migrations
- `ts-service/` (TalentFlow): NestJS + TypeORM

The repository is intentionally incomplete for assessment features. Candidates should build within the existing structure and patterns.

## Prerequisites

- Docker
- Python 3.12
- Node.js 22+
- npm

## Start Postgres

From the repository root:

```bash
docker compose up -d postgres
```

This starts PostgreSQL on `localhost:5432` with:

- host: `localhost` or `127.0.0.1`
- port: `5432`
- database: `assessment_db`
- user: `assessment_user`
- password: `assessment_pass`

## Service Guides

- Python service setup and commands: [python-service/README.md](python-service/README.md)
- TypeScript service setup and commands: [ts-service/README.md](ts-service/README.md)

## Notes

- Keep your solution focused on the assessment tasks.
- Do not replace the project structure with a different architecture.

---
# InsightOps Python Service

FastAPI service implementing the **Mini Briefing Report Generator** feature.

## Features

- Create and retrieve analyst briefing reports
- Server-side HTML report rendering via Jinja2
- Relational data model with full validation
- Manual SQL migration runner
- In-memory SQLite test suite (no external services required)

---

## Prerequisites

- Python 3.12+ (tested on 3.12 and 3.14)
- PostgreSQL — start with Docker from the repository root:

```bash
docker compose up -d postgres
```

---

## Setup

```bash
cd python-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` if your PostgreSQL credentials differ from the defaults.

**Environment variables** (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://assessment_user:assessment_pass@localhost:5432/assessment_db` | PostgreSQL connection string |
| `APP_ENV` | `development` | Environment label |
| `APP_PORT` | `8000` | Port the service listens on |

---

## Run Migrations

Apply all pending migrations:

```bash
python -m app.db.run_migrations up
```

Roll back the latest migration:

```bash
python -m app.db.run_migrations down --steps 1
```

How the runner works:
- SQL files live in `db/migrations/`
- A `schema_migrations` table tracks applied filenames
- Up files are applied in sorted filename order (`*.sql` or `*.up.sql`)
- Each up migration has a paired `*.down.sql` for rollback
- Already-applied migrations are skipped on subsequent runs

---

## Run the Service

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs available at: `http://localhost:8000/docs`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/briefings` | List all briefings (paginated) |
| `POST` | `/briefings` | Create a new briefing |
| `GET` | `/briefings/{id}` | Retrieve a briefing's structured data |
| `POST` | `/briefings/{id}/generate` | Generate and persist the HTML report |
| `GET` | `/briefings/{id}/html` | Fetch the rendered HTML report |

### Example: List briefings

```bash
# Default (page 1, 20 per page)
curl http://localhost:8000/briefings

# With pagination
curl "http://localhost:8000/briefings?page=2&size=10"
```

Response shape:

```json
{
  "items": [...],
  "total": 42,
  "page": 2,
  "size": 10,
  "pages": 5
}
```

Query parameters:

| Parameter | Default | Constraints | Description |
|---|---|---|---|
| `page` | `1` | >= 1 | Page number |
| `size` | `20` | 1–100 | Items per page |

Results are ordered by `created_at` descending (newest first).

### Example: Create a briefing

```bash
curl -X POST http://localhost:8000/briefings \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Holdings",
    "ticker": "ACME",
    "sector": "Industrial Technology",
    "analystName": "Jane Doe",
    "summary": "Acme is benefiting from strong enterprise demand.",
    "recommendation": "Monitor for margin expansion before increasing exposure.",
    "keyPoints": [
      "Revenue grew 18% year-over-year.",
      "Management raised full-year guidance."
    ],
    "risks": [
      "Top two customers account for 41% of total revenue."
    ],
    "metrics": [
      { "name": "Revenue Growth", "value": "18%" },
      { "name": "Operating Margin", "value": "22.4%" }
    ]
  }'
```

### Example: Generate and view the report

```bash
# Generate
curl -X POST http://localhost:8000/briefings/1/generate

# Fetch HTML
curl http://localhost:8000/briefings/1/html
```

---

## Run Tests

Tests use an in-memory SQLite database — no running PostgreSQL required.

```bash
source .venv/bin/activate
python -m pytest
```

Run with verbose output:

```bash
python -m pytest -v
```

---

## Project Layout

```
app/
  main.py              # FastAPI bootstrap and router wiring
  config.py            # Environment config (pydantic-settings)
  api/
    briefings.py       # Briefing route handlers (5 endpoints)
    sample_items.py    # Starter example routes
    health.py          # Health check
  models/
    briefing.py        # Briefing, BriefingPoint, BriefingMetric ORM models
    sample_item.py     # Starter example model
  schemas/
    briefing.py        # Pydantic request/response schemas + validation
    sample_item.py     # Starter example schemas
  services/
    briefing_service.py    # CRUD operations (create, list, get, save HTML)
    briefing_formatter.py  # View model builder + Jinja2 render
  db/
    session.py         # SQLAlchemy engine and session factory
    run_migrations.py  # Manual SQL migration runner
  templates/
    briefing_report.html   # Professional HTML report template
    base.html              # Starter base template
db/
  migrations/
    001_create_sample_items.sql
    002_create_briefings.sql      # briefings, briefing_points, briefing_metrics
    *.down.sql                    # Paired rollback files
tests/
  test_briefings.py    # 17 tests covering all endpoints and validation
  test_sample_items.py # Starter example tests
```

---

## Assumptions and Tradeoffs

**`briefing_points` table stores both key points and risks**
A single table with a `point_type` discriminator (`key_point` / `risk`) was chosen over two separate tables. This simplifies joins and keeps the schema DRY since the two types share identical structure. The tradeoff is that a `CHECK` constraint enforces valid type values rather than the schema itself.

**HTML is stored in the `briefings` table**
The rendered HTML is persisted to a `html_content` column rather than generated on every `GET /html` request. This makes reads cheap and ensures the report is a stable snapshot — re-running generate will overwrite with a fresh render.

**`GET /html` returns 409 before generate is called**
Rather than auto-generating on first `GET /html`, the two steps are kept explicit. This matches the spec and avoids unexpected side effects on read requests.

**Ticker validation is enforced at both the API and DB layer**
Pydantic rejects non-uppercase tickers at the API boundary. A `CHECK (ticker = upper(ticker))` constraint on the DB column provides a secondary guarantee.

**Metric name uniqueness is enforced at both layers**
A `model_validator` in the Pydantic schema catches duplicates before any DB write. A `UNIQUE(briefing_id, name)` constraint in the migration catches any edge cases at the DB layer.

**`display_order` reflects insertion order**
Key points, risks, and metrics are stored with a `display_order` based on their position in the request array. The formatter uses this to sort items consistently for display.

**SQLAlchemy Column-style declarations used instead of `Mapped[]`**
`Mapped[X | None]` annotation syntax is incompatible with SQLAlchemy 2.0.36 on Python 3.14 due to a `Union.__getitem__` regression. Classic `Column(...)` declarations are functionally equivalent and work across all supported Python versions.

---
# TalentFlow TypeScript Service

NestJS service implementing the **Candidate Document Intake + Summary Workflow** feature.

## Features

- Upload and store candidate documents (resume, cover letter, etc.)
- Async summary generation via a queue/worker flow
- Structured LLM output using Google Gemini API
- Workspace-scoped access control on all endpoints
- TypeORM migrations with full up/down support
- Unit tests using a fake provider — no external API calls required

---

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL — start with Docker from the repository root:

```bash
docker compose up -d postgres
```

---

## Setup

```bash
cd ts-service
npm install
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the service listens on |
| `DATABASE_URL` | `postgres://assessment_user:assessment_pass@localhost:5432/assessment_db` | PostgreSQL connection string |
| `NODE_ENV` | `development` | Environment label |
| `GEMINI_API_KEY` | _(empty)_ | Google Gemini API key — see LLM section below |

**Do not commit API keys or secrets.**

---

## Run Migrations

Apply all pending migrations:

```bash
npm run migration:run
```

Revert the last migration:

```bash
npm run migration:revert
```

Show migration status:

```bash
npm run migration:show
```

Migrations live in `src/migrations/` and are tracked in the `typeorm_migrations` table.

---

## Seed the Database

After running migrations, seed `workspace-1` and 10 sample candidates:

```bash
npm run seed
```

The seed script lives at `scripts/seed-candidates.ts` and uses the same `DATABASE_URL` env var as the service. Re-running is safe — existing rows are skipped.

---

## Run the Service

Development (with watch/reload):

```bash
npm run start:dev
```

Production:

```bash
npm run build
npm run start:prod
```

The service runs on `http://localhost:3000` by default.

---

## API Endpoints

All endpoints require auth headers (see **Authentication** below).

| Method | Path | Status | Description |
|---|---|---|---|
| `GET` | `/candidates` | 200 | List candidates in the workspace (paginated) |
| `POST` | `/candidates/:candidateId/documents` | 201 | Upload a candidate document |
| `POST` | `/candidates/:candidateId/summaries/generate` | 202 | Request async summary generation |
| `GET` | `/candidates/:candidateId/summaries` | 200 | List summaries for a candidate |
| `GET` | `/candidates/:candidateId/summaries/:summaryId` | 200 | Get a single summary |

### Example: List candidates

```bash
curl "http://localhost:3000/candidates?page=1&size=20" \
  -H "x-user-id: user-1" \
  -H "x-workspace-id: workspace-1"
```

Query parameters:

| Parameter | Default | Description |
|---|---|---|
| `page` | `1` | Page number (1-based) |
| `size` | `20` | Items per page (max 100) |

Response shape:

```json
{
  "data": [...],
  "total": 10,
  "page": 1,
  "size": 20
}
```

### Example: Upload a document

```bash
curl -X POST http://localhost:3000/candidates/candidate-1/documents \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" \
  -H "x-workspace-id: workspace-1" \
  -d '{
    "documentType": "resume",
    "fileName": "cv.pdf",
    "storageKey": "s3://bucket/candidate-1/cv.pdf",
    "rawText": "Experienced software engineer with 5 years of TypeScript..."
  }'
```

### Example: Generate a summary

```bash
curl -X POST http://localhost:3000/candidates/candidate-1/summaries/generate \
  -H "x-user-id: user-1" \
  -H "x-workspace-id: workspace-1"
```

Returns `202 Accepted` immediately. Poll `GET /summaries/:id` to check status (`pending` → `completed` / `failed`).

### Example: Fetch a summary

```bash
curl http://localhost:3000/candidates/candidate-1/summaries/summary-id \
  -H "x-user-id: user-1" \
  -H "x-workspace-id: workspace-1"
```

---

## Authentication

All endpoints use a fake local auth guard. Include these headers on every request:

| Header | Example | Description |
|---|---|---|
| `x-user-id` | `user-1` | Any non-empty string |
| `x-workspace-id` | `workspace-1` | Workspace identifier used for access scoping |

Requests missing either header receive `401 Unauthorized`.

---

## LLM Configuration

The service uses the **Google Gemini API** (`gemini-2.0-flash`) for summary generation.

### Get an API key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a free API key
3. Set it in your `.env`:

```
GEMINI_API_KEY=your_key_here
```

**When `GEMINI_API_KEY` is not set**, the service automatically falls back to a `FakeSummarizationProvider` that returns deterministic mock output. This is also what the test suite uses — no real API calls are made during tests.

---

## Run Tests

Unit tests (no database or external APIs required):

```bash
npm test
```

End-to-end tests:

```bash
npm run test:e2e
```

Tests use a fake `SummarizationProvider` injected via NestJS DI — the real Gemini provider is never called.

---

## Project Layout

```
src/
  app.module.ts                  # Root module
  main.ts                        # Bootstrap with global ValidationPipe
  auth/
    fake-auth.guard.ts           # Validates x-user-id / x-workspace-id headers
    auth-user.decorator.ts       # @CurrentUser() parameter decorator
    auth.types.ts                # AuthUser interface
  candidates/
    candidates.controller.ts     # 5 route handlers (list, upload, generate, list summaries, get summary)
    candidates.service.ts        # CRUD + access control logic
    summary.worker.ts            # Queue consumer — calls provider, persists result
    dto/
      upload-document.dto.ts     # Validated document upload input
      pagination-query.dto.ts    # Validated page/size query params
  scripts/
    seed-candidates.ts           # Seeds workspace-1 and 10 candidates (npm run seed)
  entities/
    candidate-document.entity.ts # Document ORM entity
    candidate-summary.entity.ts  # Summary ORM entity (status, score, etc.)
    sample-candidate.entity.ts   # Starter candidate entity
    sample-workspace.entity.ts   # Starter workspace entity
  llm/
    summarization-provider.interface.ts  # SummarizationProvider interface + token
    gemini-summarization.provider.ts     # Real Gemini provider with output validation
    fake-summarization.provider.ts       # Deterministic fake for tests and dev
    llm.module.ts                        # Wires Gemini or fake based on GEMINI_API_KEY
  queue/
    queue.service.ts             # In-memory job queue
    queue.module.ts
  migrations/
    1710000000000-InitialStarterEntities.ts
    1710000000001-CreateCandidateDocumentsAndSummaries.ts
  config/
    typeorm.options.ts           # Entity + migration registration
    typeorm.config.ts            # CLI DataSource
```

---

## Assumptions and Tradeoffs

**`candidateId` must already exist in `sample_candidates`**
The spec provides candidates via the starter `SampleModule`. This service does not create candidates — it only attaches documents and summaries to existing ones. Attempting to upload a document for an unknown or cross-workspace candidate returns `403 Forbidden`.

**Access control returns 403, not 404, for cross-workspace candidates**
Returning `404` on a cross-workspace candidate access would leak whether a candidate ID exists. A `403` is returned instead, which reveals nothing about candidates outside the requester's workspace.

**Summary generation is fire-and-forget after 202**
The controller enqueues the job and returns `202 Accepted` immediately. The worker runs in the same process (no separate worker process), which is appropriate for this assessment's scope. In production this would be a separate consumer (BullMQ, SQS, etc.).

**`workspace_id` is denormalized onto documents and summaries**
Both tables store `workspace_id` directly (in addition to `candidate_id`) to enable efficient workspace-scoped queries without joining `sample_candidates` on every read.

**Gemini falls back to fake provider when key is absent**
The `LlmModule` checks `GEMINI_API_KEY` at startup and wires the appropriate provider. This keeps the service runnable locally without requiring a real API key.

**Gemini output is strictly validated before saving**
The provider parses and validates all fields (`score`, `strengths`, `concerns`, `summary`, `recommendedDecision`) and throws on any malformed response. The worker catches this and marks the summary as `failed` with an `errorMessage`.

**`documentType` is validated against a fixed list**
Accepted values: `resume`, `cover_letter`, `portfolio`, `other`. This is a DTO-level constraint and is not enforced at the database level, which is intentional for flexibility.

