import os
import sys

import httpx


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-20b:free"
CONNECTIVITY_PROMPT = "What is 2 + 2? Reply with only the number."
REQUEST_TIMEOUT_SECONDS = 15.0


class OpenRouterConfigurationError(Exception):
    """Raised when the local OpenRouter configuration is incomplete."""


class OpenRouterServiceError(Exception):
    """Raised when OpenRouter cannot provide a usable completion."""


class OpenRouterClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY")

    def complete(self, prompt: str) -> str:
        if not self.api_key:
            raise OpenRouterConfigurationError("OPENROUTER_API_KEY is not configured.")

        try:
            response = httpx.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "Project Management MVP",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise OpenRouterServiceError("OpenRouter rejected the request.") from error
        except httpx.HTTPError as error:
            raise OpenRouterServiceError("OpenRouter is unavailable.") from error

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (IndexError, KeyError, TypeError, ValueError) as error:
            raise OpenRouterServiceError("OpenRouter returned an invalid response.") from error

        if not isinstance(content, str) or not content.strip():
            raise OpenRouterServiceError("OpenRouter returned an invalid response.")

        return content


def check_connectivity() -> str:
    return OpenRouterClient().complete(CONNECTIVITY_PROMPT)


def main() -> None:
    try:
        print(check_connectivity())
    except (OpenRouterConfigurationError, OpenRouterServiceError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
