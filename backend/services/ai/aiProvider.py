"""Abstract AI provider.

The application never imports the OpenAI SDK directly outside of
`openaiProvider.py`; everything else talks to this protocol. That makes
the rest of the codebase independent of the vendor and gives us a clean
place to translate vendor-specific errors into a small set of typed
exceptions the route layer can map to user-friendly HTTP responses.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Protocol


# ---- typed exceptions ------------------------------------------------------
# These exist so the route layer can catch each one and turn it into a
# specific, user-friendly HTTPException message. They are deliberately
# small and have no SDK dependencies (the SDK errors are converted into
# these inside openaiProvider.py).

class AIError(Exception):
    """Base class for all provider errors surfaced to callers."""


class AIAuthError(AIError):
    """401-class: bad / missing API key."""


class AIRateLimitError(AIError):
    """429-class: too many requests, or quota exhausted."""


class AITimeoutError(AIError):
    """408-class: the provider took too long."""


class AIValidationError(AIError):
    """422-class: the model output didn't match the requested schema,
    or the caller asked for an invalid combination of arguments
    (e.g. count > 20, missing required field)."""


class AIUnknownError(AIError):
    """Catch-all for anything the SDK did that we didn't anticipate."""


# ---- the protocol ----------------------------------------------------------


class AIProvider(Protocol):
    """Minimal contract every provider must satisfy.

    `generate_json` asks the model for a single JSON object that matches
    `json_schema` (OpenAI's structured-outputs schema dict). It returns
    the parsed dict so the caller doesn't have to deal with string
    parsing.

    `generate_text` is an optional escape hatch for prompts where we
    don't need structured output (not used by the assessment generator
    today, but kept for future prompts that ask the model to write a
    free-form summary or rubric).
    """

    def generate_json(
        self,
        system: str,
        user: str,
        *,
        json_schema: Dict[str, Any],
        schema_name: str = "response",
        model: Optional[str] = None,
        temperature: float = 0.4,
    ) -> Dict[str, Any]:
        ...

    def generate_text(
        self,
        system: str,
        user: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.4,
    ) -> str:
        ...
