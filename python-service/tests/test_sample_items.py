from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import SampleItem  # noqa: F401


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


def test_create_and_list_sample_items(client: TestClient) -> None:
    create_response = client.post(
        "/sample-items",
        json={"name": "Starter Item", "description": "Used for starter validation"},
    )

    assert create_response.status_code == 201
    created_payload = create_response.json()
    assert created_payload["name"] == "Starter Item"

    list_response = client.get("/sample-items")
    assert list_response.status_code == 200

    items = list_response.json()
    assert len(items) == 1
    assert items[0]["id"] == created_payload["id"]
