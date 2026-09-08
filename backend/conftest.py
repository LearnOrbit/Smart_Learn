"""
Pytest configuration and fixtures for testing
This file is loaded before any tests run
"""

import database
from fastapi.testclient import TestClient
from main import app
from database import get_db
from models import Base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine
import pytest
import sys
import os

# Set environment to test BEFORE importing anything else
os.environ["DATABASE_URL"] = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory SQLite database for each test"""
    # Create fresh engine for each test
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Patch the database module's engine to use our test engine
    original_engine = database.engine
    database.engine = engine

    yield engine

    # Cleanup
    database.engine = original_engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_db) -> Session:
    """Provide a database session for each test"""
    SessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_db
    )
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()


class _CompatibleTestClient(TestClient):
    def __init__(self, app, base_url="http://testserver", raise_server_exceptions=True, root_path="", backend="asyncio", backend_options=None, cookies=None, headers=None):
        import httpx
        from starlette.testclient import _TestClientTransport, _AsyncBackend, _is_asgi3, _WrapASGI2
        self.async_backend = _AsyncBackend(backend=backend, backend_options=backend_options or {})
        if _is_asgi3(app):
            asgi_app = app
        else:
            asgi_app = _WrapASGI2(app)
        self.app = asgi_app
        self.app_state = {}
        transport = _TestClientTransport(
            self.app,
            portal_factory=self._portal_factory,
            raise_server_exceptions=raise_server_exceptions,
            root_path=root_path,
            app_state=self.app_state,
        )
        if headers is None:
            headers = {}
        headers.setdefault("user-agent", "testclient")
        httpx.Client.__init__(
            self,
            base_url=base_url,
            headers=headers,
            transport=transport,
            follow_redirects=True,
            cookies=cookies,
        )


@pytest.fixture(scope="function")
def client(db_session):
    """Provide a FastAPI test client with overridden database dependency"""
    def override_get_db():
        yield db_session

    # Clear any previous overrides
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db

    try:
        test_client = TestClient(app)
    except TypeError:
        test_client = _CompatibleTestClient(app)

    yield test_client

    # Cleanup overrides
    app.dependency_overrides.clear()
