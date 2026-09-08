import sys
from unittest.mock import patch

sys.path.insert(0, ".")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import _score_structured_rubric, app, get_current_user


def test_structured_rubric_scores_matching_keywords_deterministically():
    rubric = '{"criteria":[{"name":"Definition","keywords":["osmosis"],"marks":2},{"name":"Example","keywords":["plant", "root"],"marks":2}]}'

    result = _score_structured_rubric(rubric, "Osmosis moves water in a plant root.", 4)

    assert result == [
        {
            "criterion": "Definition",
            "score": 2.0,
            "max_score": 2.0,
            "matched": True,
            "matched_keywords": ["osmosis"],
            "weight": 0.5,
        },
        {
            "criterion": "Example",
            "score": 2.0,
            "max_score": 2.0,
            "matched": True,
            "matched_keywords": ["plant", "root"],
            "weight": 0.5,
        },
    ]


def test_plain_text_rubric_is_left_for_legacy_keyword_scoring():
    assert _score_structured_rubric("definition, example", "definition", 2) is None


@pytest.fixture
def trends_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: {"id": "teacher-1", "role": "teacher"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def test_authenticated_research_trend_crud(trends_client):
    created = trends_client.post(
        "/api/research-trends",
        json={"title": "Edge AI", "summary": "Local inference", "tags": ["AI"]},
    )
    assert created.status_code == 201
    trend_id = created.json()["id"]

    listed = trends_client.get("/api/research-trends")
    assert listed.status_code == 200
    assert listed.json()[0]["tags"] == ["AI"]

    updated = trends_client.put(
        f"/api/research-trends/{trend_id}",
        json={"title": "Edge AI", "summary": "Updated", "tags": ["AI", "ML"]},
    )
    assert updated.status_code == 200
    assert updated.json()["summary"] == "Updated"

    deleted = trends_client.delete(f"/api/research-trends/{trend_id}")
    assert deleted.status_code == 200


def test_crossref_search_normalizes_external_results_without_persisting(trends_client):
    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"message":{"items":[{"DOI":"10.1234/demo","title":["A research trend"],"abstract":"<jats:p>Abstract text</jats:p>","URL":"https://doi.org/10.1234/demo","published":{"date-parts":[[2026,9]]},"author":[{"family":"Smith"}],"container-title":["Demo Journal"]}]}}'

    with patch("main.urlopen", return_value=FakeResponse()):
        response = trends_client.get("/api/research-trends/search/crossref", params={"q": "learning", "rows": 1})

    assert response.status_code == 200
    result = response.json()[0]
    assert result["id"] == "crossref:10.1234/demo"
    assert result["summary"] == "Abstract text"
    assert result["created_by"] == "crossref"
    assert trends_client.get("/api/research-trends").json() == []


def test_bulk_attendance_and_session_summary(trends_client):
    created = trends_client.post("/api/attendance/sessions", json={"title": "Lecture", "session_date": "2026-09-07"})
    assert created.status_code == 201
    session_id = created.json()["id"]

    bulk = trends_client.post(
        f"/api/attendance/sessions/{session_id}/records/bulk",
        json={"records": [
            {"student_id": "student-1", "status": "present"},
            {"student_id": "student-2", "status": "late"},
            {"student_id": "student-3", "status": "absent"},
        ]},
    )
    assert bulk.status_code == 200
    assert bulk.json()["updated"] == 3

    summary = trends_client.get(f"/api/attendance/sessions/{session_id}/summary")
    assert summary.status_code == 200
    assert summary.json()["attendance_percentage"] == 50.0


def test_printable_accreditation_report_is_html(trends_client):
    response = trends_client.get("/api/reports/accreditation-html")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Smart Learn Accreditation Report" in response.text
