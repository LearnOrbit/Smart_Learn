"""AI generation service package.

Public surface (used by ai_generator_routes.py):

    from backend.services.ai import (
        AIProvider,            # protocol
        GeminiProvider,        # concrete
        get_provider,          # factory: returns the configured provider
        AIAuthError, AIRateLimitError, AITimeoutError,
        AIValidationError, AIUnknownError,
    )

The factory is environment-driven:

    AI_PROVIDER=gemini  -> GeminiProvider (default)
    AI_PROVIDER=mock    -> MockProvider   (no network, useful in tests)

Gemini is the only real provider wired up; the protocol leaves room
for adding another vendor later without touching callers.
"""
from .aiProvider import (
    AIProvider,
    AIAuthError,
    AIRateLimitError,
    AITimeoutError,
    AIValidationError,
    AIUnknownError,
)
from .geminiProvider import GeminiProvider, MockProvider


def get_provider() -> AIProvider:
    """Return the provider selected by the AI_PROVIDER env var.

    Defaults to GeminiProvider. Raises AIUnknownError if the configured
    provider name is unknown — caller should turn that into a friendly
    500, never a stack trace.
    """
    import os
    name = (os.environ.get("AI_PROVIDER") or "gemini").lower().strip()
    if name in ("gemini", ""):
        return GeminiProvider()
    if name == "mock":
        return MockProvider()
    raise AIUnknownError(f"Unknown AI_PROVIDER '{name}'.")


__all__ = [
    "AIProvider",
    "GeminiProvider",
    "MockProvider",
    "get_provider",
    "AIAuthError",
    "AIRateLimitError",
    "AITimeoutError",
    "AIValidationError",
    "AIUnknownError",
]
