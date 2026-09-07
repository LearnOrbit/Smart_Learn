"""Concrete Google Gemini provider.

Why a class wrapper and not just calling the SDK inline at the call
site? Same reasons as the previous OpenAI wrapper:

1. We need to map SDK-specific exceptions (auth, rate limit, timeout,
   schema rejections) to our small set of typed exceptions
   (`AIAuthError`, `AIRateLimitError`, ...). Doing that once here means
   the route layer never has to import the SDK or know the difference
   between a 401 and a 429.

2. We want a single place to ensure the API key is read from the
   environment, never logged, and never sent to the browser. The
   provider reads `GEMINI_API_KEY` at construction time and stashes
   the value on `self`; nothing else in the process ever sees it.

Why `google-genai` (the new SDK) and not `google-generativeai` (the
old one)? Both work. The new SDK is what Google currently ships and
documents; the old one is in maintenance mode. Same underlying API,
cleaner surface, typed exceptions out of the box.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from .aiProvider import (
    AIAuthError,
    AIRateLimitError,
    AITimeoutError,
    AIUnknownError,
    AIValidationError,
)

log = logging.getLogger(__name__)

# `gemini-3.6-flash` is the stable Flash model for quiz/MCQ generation.
# It's the most recent Flash variant in the "stable" tier that
# supports structured output (`response_schema`) — newer 3.7/3.8
# releases are also available but we stay on 3.6 for predictable
# JSON-schema behavior across deployments.
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")


class GeminiProvider:
    """Thin wrapper around the Google GenAI `generate_content` API.

    The provider is constructed lazily: we don't import the SDK at
    module load time so the package stays importable in environments
    where the SDK isn't installed (e.g. CI type-checks, `ast.parse`
    smoke tests). The first call to `generate_json` triggers the
    import; a missing SDK is then reported as AIUnknownError, not as
    an ImportError stack trace.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = DEFAULT_MODEL):
        # Note: never log `api_key`. We accept it as a kwarg purely so
        # tests can inject a dummy value.
        self._api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self._api_key:
            # Defer the failure to the call site so importing this
            # module doesn't blow up the entire process.
            self._client = None
        else:
            self._client = self._build_client(self._api_key)
        self.model = model

    # ---- public API ------------------------------------------------------

    def generate_json(
        self,
        system: str,
        user: str,
        *,
        json_schema: Dict[str, Any],
        schema_name: str = "response",  # accepted for protocol parity;
                                         # Gemini doesn't use a name
                                         # separately from the schema.
        model: Optional[str] = None,
        temperature: float = 0.4,
    ) -> Dict[str, Any]:
        if not self._client:
            raise AIAuthError(
                "GEMINI_API_KEY is not configured on the server. "
                "Add it to backend/.env and restart the API."
            )

        from google.genai import types  # type: ignore  # lazy import

        client = self._client
        chosen_model = model or self.model

        # Gemini supports structured output via `response_mime_type` +
        # `response_schema`. The schema is the same dict shape we
        # already pass to OpenAI's `json_schema.strict` mode, so the
        # prompts module doesn't need to know which provider is wired —
        # we just convert JSON Schema → OpenAPI 3.0 on the way in
        # because Gemini's validator rejects JSON-Schema-only keys
        # like `additionalProperties: false`.
        openapi_schema = self._to_openapi_schema(json_schema)
        try:
            response = client.models.generate_content(
                model=chosen_model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=temperature,
                    response_mime_type="application/json",
                    response_schema=openapi_schema,
                ),
            )
        except Exception as e:  # noqa: BLE001 — we re-raise as typed
            raise self._map_error(e) from e

        # Structured-output mode guarantees a JSON string in
        # `response.text`. Parse it; if the model ever returns
        # something we can't parse, surface a friendly validation
        # error rather than a 500.
        try:
            text = response.text or "{}"
            return json.loads(text)
        except (json.JSONDecodeError, AttributeError) as e:
            raise AIValidationError(
                "The AI returned a response we couldn't parse. Please try again."
            ) from e

    def generate_text(
        self,
        system: str,
        user: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.4,
    ) -> str:
        if not self._client:
            raise AIAuthError(
                "GEMINI_API_KEY is not configured on the server."
            )

        from google.genai import types  # type: ignore  # lazy import

        try:
            response = self._client.models.generate_content(
                model=model or self.model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=temperature,
                ),
            )
        except Exception as e:  # noqa: BLE001
            raise self._map_error(e) from e
        return (response.text or "").strip()

    # ---- internals -------------------------------------------------------

    @staticmethod
    def _to_openapi_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a JSON Schema dict (OpenAI's strict-mode shape) into
        an OpenAPI 3.0 schema (what Gemini's `response_schema` accepts).

        Why this exists: Gemini's structured-outputs feature only accepts
        OpenAPI 3.0 schemas. JSON Schema and OpenAPI 3.0 are very close
        but not identical. The differences that actually bite us in
        practice are:

        1. `additionalProperties: false` is valid JSON Schema but
           rejected by Gemini's schema validator (it expects either a
           schema object or to omit the key entirely).
        2. `bool` values anywhere Gemini expects a schema produce
           "Extra inputs are not permitted" errors.

        We don't try to be a complete JSON Schema → OpenAPI 3.0
        converter; we only handle the keys the prompt module actually
        uses (`type`, `properties`, `required`, `items`, `enum`,
        `minLength`, `minimum`, `maximum`, `minItems`, `maxItems`,
        `format`, `description`, `title`, `nullable`).
        """
        SUPPORTED = {
            "type", "properties", "required", "items", "enum",
            "minLength", "minimum", "maximum", "minItems", "maxItems",
            "format", "description", "title", "nullable",
        }
        if not isinstance(schema, dict):
            return schema
        out: Dict[str, Any] = {}
        for k, v in schema.items():
            if k not in SUPPORTED:
                # `additionalProperties`, `$schema`, `examples`, etc.
                # Drop silently — they're legal JSON Schema but Gemini
                # doesn't understand them.
                continue
            if k == "properties" and isinstance(v, dict):
                out[k] = {pk: GeminiProvider._to_openapi_schema(pv) for pk, pv in v.items()}
            elif k == "items":
                out[k] = GeminiProvider._to_openapi_schema(v)
            else:
                out[k] = v
        return out

    @staticmethod
    def _build_client(api_key: str):
        """Build the GenAI client. Imported lazily so module import
        doesn't require the SDK to be installed."""
        try:
            from google import genai  # type: ignore
        except ImportError as e:  # pragma: no cover
            raise AIUnknownError(
                "The 'google-genai' package is not installed. "
                "Run `pip install -r backend/requirements.txt`."
            ) from e
        return genai.Client(api_key=api_key)

    @staticmethod
    def _map_error(e: Exception):
        """Translate google-genai errors into our typed exceptions.

        We do this by name (string match against the class name) rather
        than importing the SDK's exception classes, so the provider
        works even on SDK versions that rename or relocate them. The
        google-genai SDK raises standard subclasses of `GoogleAPIError`
        for transport problems, so name-based matching is robust.
        """
        name = type(e).__name__
        msg = str(e) or name

        # Auth-class: bad key, project disabled, etc.
        # google-genai raises `ClientError` (4xx) and `ServerError` (5xx)
        # — auth specifically is `PermissionDenied` (403) or `Unauthorized`
        # (401). Match on the substring so we catch both.
        if "PermissionDenied" in name or "Unauthorized" in name or "APIKey" in name:
            return AIAuthError(
                "The server's Gemini API key is invalid or missing. "
                "Please contact your administrator."
            )
        # Quota / rate-limit. google-genai raises `ResourceExhausted`
        # (429) for both per-minute rate limits and daily quota.
        if "ResourceExhausted" in name or "TooManyRequests" in name or "RateLimit" in name:
            return AIRateLimitError(
                "We've hit Gemini's rate limit. Please wait a moment and try again."
            )
        # Timeouts: SDK wraps the underlying `httpx.TimeoutException`
        # as `DeadlineExceeded`.
        if "DeadlineExceeded" in name or "Timeout" in name:
            return AITimeoutError(
                "The AI service took too long to respond. Please try again."
            )
        # Schema-rejection or other 4xx that isn't auth/rate-limit.
        if "ClientError" in name or "InvalidArgument" in name:
            log.warning("Gemini ClientError: %s", msg[:200])
            return AIValidationError(
                "The AI couldn't generate questions for this request. "
                "Try changing the topic or the difficulty."
            )
        # 5xx from Google.
        if "ServerError" in name or "ServiceUnavailable" in name:
            return AIUnknownError(
                "We couldn't reach the AI service. Please try again in a moment."
            )
        # Anything else — log the type but don't leak details.
        log.warning("Gemini unknown error: %s: %s", name, msg[:200])
        return AIUnknownError(
            "Something went wrong while generating questions. Please try again."
        )


class MockProvider:
    """A no-network provider used by tests and local development.

    Returns deterministic, schema-conformant JSON so the route layer
    can be exercised end-to-end without a real Gemini key. Never used
    in production unless AI_PROVIDER=mock is set explicitly.
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
        return _synthesize(schema_name, user)

    def generate_text(
        self,
        system: str,
        user: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.4,
    ) -> str:
        return "Mock provider: no AI content generated."


def _synthesize(schema_name: str, user: str) -> Dict[str, Any]:
    """Build a minimal but schema-valid mock response."""
    if schema_name == "qa_questions":
        return {
            "questions": [
                {
                    "question": f"Mock question about: {user[:60]}",
                    "answer": "Mock answer — set GEMINI_API_KEY for real output.",
                    "marks": 5,
                    "difficulty": "medium",
                    "bloom_level": "Understand",
                    "course_outcome_code": "CO1",
                    "source_type": "topic",
                }
            ]
        }
    if schema_name == "mcq_questions":
        return {
            "mcqs": [
                {
                    "question": f"Mock MCQ about: {user[:60]}",
                    "option_a": "Option A",
                    "option_b": "Option B",
                    "option_c": "Option C",
                    "option_d": "Option D",
                    "correct_answer": "A",
                    "explanation": "Mock explanation.",
                    "marks": 1,
                    "difficulty": "medium",
                    "bloom_level": "Understand",
                    "course_outcome_code": "CO1",
                    "source_type": "topic",
                }
            ]
        }
    if schema_name == "single_question":
        return {
            "question": "Regenerated mock question",
            "answer": "Mock regenerated answer.",
            "marks": 5,
            "difficulty": "medium",
            "bloom_level": "Apply",
            "course_outcome_code": "CO1",
            "source_type": "topic",
        }
    if schema_name == "single_mcq":
        return {
            "question": "Regenerated mock MCQ",
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_answer": "B",
            "explanation": "Mock.",
            "marks": 1,
            "difficulty": "medium",
            "bloom_level": "Apply",
            "course_outcome_code": "CO1",
            "source_type": "topic",
        }
    return {}
