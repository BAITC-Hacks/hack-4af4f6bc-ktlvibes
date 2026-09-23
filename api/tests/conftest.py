import os

os.environ["DATABASE_URL"] = "postgresql+psycopg://aisana:aisana@db:5432/aisana_test"

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from app.db import engine
from app.main import app


@pytest.fixture
def client():
    assert engine.url.database == "aisana_test"
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as test_client:
        yield test_client
