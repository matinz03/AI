from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_example_api_returns_message() -> None:
    response = client.get("/api/example")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello from the PM backend"}


def test_root_serves_example_html() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "Hello World" in response.text
    assert "text/html" in response.headers["content-type"]


def test_unknown_api_route_is_not_rewritten_to_index() -> None:
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
