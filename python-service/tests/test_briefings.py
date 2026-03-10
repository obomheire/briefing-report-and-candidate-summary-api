"""
Tests for the briefings feature.

Uses an in-memory SQLite database (same pattern as test_sample_items.py)
so no external services or migrations are required.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Briefing, BriefingMetric, BriefingPoint  # noqa: F401 — ensure tables exist


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


VALID_PAYLOAD = {
    "companyName": "Acme Holdings",
    "ticker": "ACME",
    "sector": "Industrial Technology",
    "analystName": "Jane Doe",
    "summary": "Acme is benefiting from strong enterprise demand.",
    "recommendation": "Monitor for margin expansion before increasing exposure.",
    "keyPoints": [
        "Revenue grew 18% year-over-year.",
        "Management raised full-year guidance.",
    ],
    "risks": [
        "Top two customers account for 41% of total revenue.",
    ],
    "metrics": [
        {"name": "Revenue Growth", "value": "18%"},
        {"name": "Operating Margin", "value": "22.4%"},
    ],
}


# ---------------------------------------------------------------------------
# POST /briefings
# ---------------------------------------------------------------------------

def test_create_briefing_returns_201(client: TestClient) -> None:
    resp = client.post("/briefings", json=VALID_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ticker"] == "ACME"
    assert data["company_name"] == "Acme Holdings"
    assert len(data["key_points"]) == 2
    assert len(data["risks"]) == 1
    assert len(data["metrics"]) == 2
    assert data["is_generated"] is False


def test_create_briefing_without_metrics(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "metrics": []}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 201
    assert resp.json()["metrics"] == []


def test_create_briefing_key_points_ordered(client: TestClient) -> None:
    resp = client.post("/briefings", json=VALID_PAYLOAD)
    assert resp.status_code == 201
    points = resp.json()["key_points"]
    assert points[0]["display_order"] == 0
    assert points[1]["display_order"] == 1


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

def test_create_briefing_lowercase_ticker_rejected(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "ticker": "acme"}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    assert any("uppercase" in str(e).lower() for e in errors)


def test_create_briefing_too_few_key_points(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "keyPoints": ["Only one point."]}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_no_risks(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "risks": []}
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422


def test_create_briefing_duplicate_metric_names(client: TestClient) -> None:
    payload = {
        **VALID_PAYLOAD,
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "Revenue Growth", "value": "20%"},
        ],
    }
    resp = client.post("/briefings", json=payload)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    assert any("unique" in str(e).lower() for e in errors)


def test_create_briefing_missing_required_fields(client: TestClient) -> None:
    resp = client.post("/briefings", json={"ticker": "ACME"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /briefings/{id}
# ---------------------------------------------------------------------------

def test_get_briefing_returns_stored_data(client: TestClient) -> None:
    create_resp = client.post("/briefings", json=VALID_PAYLOAD)
    briefing_id = create_resp.json()["id"]

    get_resp = client.get(f"/briefings/{briefing_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["id"] == briefing_id
    assert data["ticker"] == "ACME"


def test_get_briefing_not_found(client: TestClient) -> None:
    resp = client.get("/briefings/99999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /briefings/{id}/generate
# ---------------------------------------------------------------------------

def test_generate_report_marks_as_generated(client: TestClient) -> None:
    briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]

    gen_resp = client.post(f"/briefings/{briefing_id}/generate")
    assert gen_resp.status_code == 200
    data = gen_resp.json()
    assert data["is_generated"] is True
    assert data["generated_at"] is not None


def test_generate_report_not_found(client: TestClient) -> None:
    resp = client.post("/briefings/99999/generate")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /briefings/{id}/html
# ---------------------------------------------------------------------------

def test_get_html_returns_text_html(client: TestClient) -> None:
    briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
    client.post(f"/briefings/{briefing_id}/generate")

    html_resp = client.get(f"/briefings/{briefing_id}/html")
    assert html_resp.status_code == 200
    assert "text/html" in html_resp.headers["content-type"]
    body = html_resp.text
    assert "Acme Holdings" in body
    assert "ACME" in body
    assert "Jane Doe" in body


def test_get_html_contains_all_sections(client: TestClient) -> None:
    briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
    client.post(f"/briefings/{briefing_id}/generate")

    body = client.get(f"/briefings/{briefing_id}/html").text
    assert "Executive Summary" in body
    assert "Key Points" in body
    assert "Risks" in body
    assert "Recommendation" in body
    assert "Key Metrics" in body
    # Metric data present
    assert "Revenue Growth" in body
    assert "18%" in body


def test_get_html_before_generate_returns_409(client: TestClient) -> None:
    briefing_id = client.post("/briefings", json=VALID_PAYLOAD).json()["id"]
    resp = client.get(f"/briefings/{briefing_id}/html")
    assert resp.status_code == 409


def test_get_html_no_metrics_section_when_empty(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "metrics": []}
    briefing_id = client.post("/briefings", json=payload).json()["id"]
    client.post(f"/briefings/{briefing_id}/generate")

    body = client.get(f"/briefings/{briefing_id}/html").text
    assert "Key Metrics" not in body


def test_get_html_not_found(client: TestClient) -> None:
    resp = client.get("/briefings/99999/html")
    assert resp.status_code == 404
