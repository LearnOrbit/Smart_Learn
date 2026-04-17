"""
Outcome PDF text parser.

Extracts Program Outcomes (PO), Course Outcomes (CO), and Learning Outcomes (LO)
from raw text extracted from PDFs.

Supported formats:
  1. Single-line with colon   — PO1: Description
  2. Single-line with dash    — PO1 - Description
  3. Single-line with dot     — PO1. Description
  4. Multi-line               — PO1\nDescription on next line(s)
  5. Course-code identifiers  — CSL603.1, CSC603.2 (mapped to CO/LO/PO via section header)
  6. Tabular rows             — 1 CSL603.1 The students should be able to ...

Returns structured dicts:
  {"type": "CO", "number": 1, "code": "CO1", "description": "...", "original_code": "CSL603.1"}
"""

from __future__ import annotations

import re
from typing import List, Dict, Optional

# ── Simple PO/CO/LO patterns ─────────────────────────────────────────

_IDENTIFIER_RE = re.compile(r'^(PO|CO|LO)(\d+)', re.IGNORECASE)

_SEPARATOR_RE = re.compile(
    r'^(PO|CO|LO)(\d+)\s*(?:[:]\s*|[-–—]\s*|[.]\s+)(.+)$',
    re.IGNORECASE,
)

_STANDALONE_RE = re.compile(r'^(PO|CO|LO)(\d+)\s*$', re.IGNORECASE)

# ── Course-code patterns (e.g. CSL603.1, CSC603 3.4) ─────────────────
# Course codes have 2-5 letters + 3-4 digit number (e.g. CSL603, CS301).
# We require at least 3 digits to avoid matching simple PO1/CO2/LO3.
# Also exclude bare PO/CO/LO prefixes via negative lookahead.

_COURSE_CODE_RE = re.compile(
    r'^(?!(?:PO|CO|LO)\d)([A-Z]{2,5}\d{3,4})\s*[.\s]\s*(\d+)\s*$',
    re.IGNORECASE,
)

_COURSE_CODE_WITH_DESC_RE = re.compile(
    r'^(?!(?:PO|CO|LO)\d)([A-Z]{2,5}\d{3,4})\s*[.\s]\s*(\d+)\s+(.+)$',
    re.IGNORECASE,
)

# Tabular row: "1 CSL603.1 Description text"
_TABLE_ROW_RE = re.compile(
    r'^\d+\s+(?!(?:PO|CO|LO)\d)([A-Z]{2,5}\d{2,4})\s*[.\s]\s*(\d+)\s+(.+)$',
    re.IGNORECASE,
)

# Handle OCR artifacts: "CSC60 3.4" → grouped as one code
_TABLE_ROW_OCR_RE = re.compile(
    r'^\d+\s+([A-Z]{2,5}\d{1,3})\s+(\d)[.\s]\s*(\d+)\s+(.+)$',
    re.IGNORECASE,
)

# Section headers — require the word OUTCOME to follow the qualifier
_SECTION_HEADER_RE = re.compile(
    r'\b(?:COURSE|LAB|PROGRAM|LEARNING)\s+OUTCOME',
    re.IGNORECASE,
)


def _is_any_identifier(line: str) -> bool:
    """Check if a line starts with any known identifier pattern."""
    return bool(
        _IDENTIFIER_RE.match(line)
        or _COURSE_CODE_RE.match(line)
        or _COURSE_CODE_WITH_DESC_RE.match(line)
        or _TABLE_ROW_RE.match(line)
    )


def _detect_section_type(line: str) -> Optional[str]:
    """Detect if a line is a section header and return the type, or None.

    Lines that start with a PO/CO/LO identifier (e.g. "PO1: Program outcome one")
    are NOT section headers even though they may contain "PROGRAM OUTCOME" in the
    description text.
    """
    # Skip lines that start with a known outcome identifier
    if _IDENTIFIER_RE.match(line):
        return None
    if _SEPARATOR_RE.match(line):
        return None
    upper = line.upper()
    if re.search(r'PROGRAM\s+OUTCOME', upper):
        return "PO"
    if re.search(r'LEARNING\s+OUTCOME', upper):
        return "LO"
    if re.search(r'(?:COURSE|LAB)\s+OUTCOME', upper):
        return "CO"
    return None


def parse_outcomes(text: str) -> List[Dict]:
    """Parse outcome text and return a list of structured outcome dicts.

    Parameters
    ----------
    text : str
        Raw text (e.g. extracted from a PDF).

    Returns
    -------
    list[dict]
        Each dict has keys: type, number, code, description.
        Course-code outcomes also include an ``original_code`` key.
    """
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    stripped: List[str] = [line.strip() for line in lines]

    outcomes: List[Dict] = []
    seen_codes: set = set()
    current_type: str = "CO"  # default type when no section header found
    i = 0

    while i < len(stripped):
        line = stripped[i]

        if not line:
            i += 1
            continue

        # ── Detect section headers ──────────────────────────────────
        detected = _detect_section_type(line)
        if detected:
            current_type = detected
            i += 1
            continue

        # Skip table header rows like "SR. OUTCOME OUTCOMESS"
        if re.match(r'^SR\.?\s', line, re.IGNORECASE) or re.match(r'^NO\.?\s', line, re.IGNORECASE):
            i += 1
            continue

        # ── Pattern 1/2/3: Simple PO/CO/LO + separator + description ──
        m = _SEPARATOR_RE.match(line)
        if m:
            otype = m.group(1).upper()
            number = int(m.group(2))
            code = f"{otype}{number}"
            desc = m.group(3).strip()

            i += 1
            while i < len(stripped) and stripped[i] and not _is_any_identifier(stripped[i]):
                desc += " " + stripped[i]
                i += 1

            desc = _clean_description(desc)
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": otype,
                    "number": number,
                    "code": code,
                    "description": desc,
                })
                seen_codes.add(code)
            continue

        # ── Pattern 4: Simple PO/CO/LO standalone ─────────────────────
        m = _STANDALONE_RE.match(line)
        if m:
            otype = m.group(1).upper()
            number = int(m.group(2))
            code = f"{otype}{number}"

            desc_parts: List[str] = []
            i += 1
            while i < len(stripped):
                next_line = stripped[i]
                if not next_line:
                    if not desc_parts:
                        i += 1
                        continue
                    else:
                        break
                if _is_any_identifier(next_line):
                    break
                desc_parts.append(next_line)
                i += 1

            desc = _clean_description(" ".join(desc_parts))
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": otype,
                    "number": number,
                    "code": code,
                    "description": desc,
                })
                seen_codes.add(code)
            continue

        # ── Pattern 5: Tabular row — "1 CSL603.1 Description" ────────
        m = _TABLE_ROW_RE.match(line)
        if m:
            original_code = f"{m.group(1).upper()}.{m.group(2)}"
            number = int(m.group(2))
            code = f"{current_type}{number}"
            desc = m.group(3).strip()

            i += 1
            while i < len(stripped) and stripped[i] and not _is_any_identifier(stripped[i]) and not _TABLE_ROW_RE.match(stripped[i]) and not _SECTION_HEADER_RE.search(stripped[i]) and not re.match(r'subject\s+incharge', stripped[i], re.IGNORECASE):
                desc += " " + stripped[i]
                i += 1

            desc = _clean_description(desc)
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": current_type,
                    "number": number,
                    "code": code,
                    "description": desc,
                    "original_code": original_code,
                })
                seen_codes.add(code)
            continue

        # ── Pattern 5b: OCR tabular row — "1 CSC60 3.4 Description" ──
        m = _TABLE_ROW_OCR_RE.match(line)
        if m:
            # OCR split the code: group(1)=CSC60, group(2)=3, group(3)=4
            reconstructed_base = f"{m.group(1).upper()}{m.group(2)}"
            original_code = f"{reconstructed_base}.{m.group(3)}"
            number = int(m.group(3))
            code = f"{current_type}{number}"
            desc = m.group(4).strip()

            i += 1
            while i < len(stripped) and stripped[i] and not _is_any_identifier(stripped[i]) and not _TABLE_ROW_RE.match(stripped[i]) and not _SECTION_HEADER_RE.search(stripped[i]) and not re.match(r'subject\s+incharge', stripped[i], re.IGNORECASE):
                desc += " " + stripped[i]
                i += 1

            desc = _clean_description(desc)
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": current_type,
                    "number": number,
                    "code": code,
                    "description": desc,
                    "original_code": original_code,
                })
                seen_codes.add(code)
            continue

        # ── Pattern 6: Course-code with desc — "CSL603.1 Description" ─
        m = _COURSE_CODE_WITH_DESC_RE.match(line)
        if m:
            original_code = f"{m.group(1).upper()}.{m.group(2)}"
            number = int(m.group(2))
            code = f"{current_type}{number}"
            desc = m.group(3).strip()

            i += 1
            while i < len(stripped) and stripped[i] and not _is_any_identifier(stripped[i]) and not _TABLE_ROW_RE.match(stripped[i]):
                desc += " " + stripped[i]
                i += 1

            desc = _clean_description(desc)
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": current_type,
                    "number": number,
                    "code": code,
                    "description": desc,
                    "original_code": original_code,
                })
                seen_codes.add(code)
            continue

        # ── Pattern 7: Course-code standalone — "CSL603.1" ────────────
        m = _COURSE_CODE_RE.match(line)
        if m:
            original_code = f"{m.group(1).upper()}.{m.group(2)}"
            number = int(m.group(2))
            code = f"{current_type}{number}"

            desc_parts = []
            i += 1
            while i < len(stripped):
                next_line = stripped[i]
                if not next_line:
                    if not desc_parts:
                        i += 1
                        continue
                    else:
                        break
                if _is_any_identifier(next_line) or _TABLE_ROW_RE.match(next_line):
                    break
                desc_parts.append(next_line)
                i += 1

            desc = _clean_description(" ".join(desc_parts))
            if desc and code not in seen_codes:
                outcomes.append({
                    "type": current_type,
                    "number": number,
                    "code": code,
                    "description": desc,
                    "original_code": original_code,
                })
                seen_codes.add(code)
            continue

        # Line doesn't match any pattern — skip
        i += 1

    return outcomes


def _clean_description(desc: str) -> str:
    """Normalize whitespace and trim a description string."""
    # Collapse multiple spaces / tabs into one space
    desc = re.sub(r'\s+', ' ', desc).strip()
    # Truncate overly long descriptions
    if len(desc) > 500:
        desc = desc[:500].rstrip()
    return desc
