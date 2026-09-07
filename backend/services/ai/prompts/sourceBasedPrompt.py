"""Source-based generation helpers.

This module is intentionally tiny: it only validates the
"source_type/source_text" pair and returns a normalized tuple that
the other prompts can use. Putting it in its own module keeps the
main prompt files focused on content and gives us a single seam to
add a token-budget pre-truncator or a citation-extraction step
later without touching the prompt templates.
"""
from __future__ import annotations

from typing import Optional, Tuple

# Maximum characters of source text we will forward to the model.
# 12k is roughly 3-4k tokens for English prose, well inside the
# context of gpt-4o-mini even after we add a long system prompt.
SOURCE_TEXT_MAX_CHARS = 12_000


def normalize_source(
    *, source_type: str, source_text: Optional[str]
) -> Tuple[str, Optional[str]]:
    """Return (source_type, source_text) with the source truncated.

    For `topic` source, the prompt doesn't use any text and the
    caller may or may not pass `topic` separately. We accept that
    here as a no-op.
    """
    if source_type not in ("topic", "syllabus", "document"):
        raise ValueError("source_type must be 'topic', 'syllabus' or 'document'")
    if not source_text:
        return source_type, None
    if len(source_text) > SOURCE_TEXT_MAX_CHARS:
        return source_type, source_text[:SOURCE_TEXT_MAX_CHARS]
    return source_type, source_text
