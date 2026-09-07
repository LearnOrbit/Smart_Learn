"""Prompt builders and JSON schemas for AI generation.

Each module exposes two things:

    build_messages(...) -> tuple[str, str]
        Returns (system_prompt, user_prompt) ready to pass to the
        provider's generate_json.

    SCHEMA: dict
        The JSON Schema the model must conform to. Kept as a plain
        dict (not a Pydantic model) because the OpenAI structured-
        outputs endpoint takes the dict directly.

We deliberately keep the schema strict (`"additionalProperties": False`
and explicit enums) so the model's first response is usually valid;
that means fewer retries and no fragile markdown-parsing in callers.
"""
