import httpx
import pytest

from app.openrouter import (
    CONNECTIVITY_PROMPT,
    OPENROUTER_MODEL,
    OPENROUTER_URL,
    OpenRouterClient,
    OpenRouterConfigurationError,
    OpenRouterServiceError,
)


def test_missing_api_key_raises_clear_configuration_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(OpenRouterConfigurationError, match="OPENROUTER_API_KEY"):
        OpenRouterClient().complete(CONNECTIVITY_PROMPT)


def test_client_sends_expected_connectivity_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def fake_post(*args, **kwargs):
        captured["url"] = args[0]
        captured.update(kwargs)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "4"}}]},
            request=httpx.Request("POST", OPENROUTER_URL),
        )

    monkeypatch.setattr(httpx, "post", fake_post)

    assert OpenRouterClient("test-key").complete(CONNECTIVITY_PROMPT) == "4"
    assert captured["url"] == OPENROUTER_URL
    assert captured["headers"]["HTTP-Referer"] == "http://localhost"
    assert captured["headers"]["X-Title"] == "Project Management MVP"
    assert captured["json"] == {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": CONNECTIVITY_PROMPT}],
    }


@pytest.mark.parametrize(
    ("response", "error_message"),
    [
        (
            httpx.Response(
                401,
                request=httpx.Request("POST", OPENROUTER_URL),
            ),
            "rejected",
        ),
        (
            httpx.Response(
                200,
                json={"choices": []},
                request=httpx.Request("POST", OPENROUTER_URL),
            ),
            "invalid response",
        ),
    ],
)
def test_provider_failures_are_controlled(
    monkeypatch: pytest.MonkeyPatch, response: httpx.Response, error_message: str
) -> None:
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: response)

    with pytest.raises(OpenRouterServiceError, match=error_message):
        OpenRouterClient("test-key").complete(CONNECTIVITY_PROMPT)


def test_network_failure_is_controlled(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*args, **kwargs):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(httpx, "post", fail)

    with pytest.raises(OpenRouterServiceError, match="unavailable"):
        OpenRouterClient("test-key").complete(CONNECTIVITY_PROMPT)
