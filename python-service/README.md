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
