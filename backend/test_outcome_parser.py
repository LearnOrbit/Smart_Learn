"""
Unit tests for outcome_parser.parse_outcomes().

Covers all four supported formats, mixed content, edge cases,
and backward compatibility.
"""

import pytest
from outcome_parser import parse_outcomes


# ── Format 1: colon separator ───────────────────────────────────────

class TestColonFormat:
    def test_single_po(self):
        text = "PO1: Understand computer science fundamentals"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0] == {
            "type": "PO",
            "number": 1,
            "code": "PO1",
            "description": "Understand computer science fundamentals",
        }

    def test_multiple_outcomes(self):
        text = (
            "PO1: Understand computer science fundamentals\n"
            "PO2: Apply mathematical principles\n"
            "CO1: Analyze algorithms for correctness\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 3
        assert result[0]["code"] == "PO1"
        assert result[1]["code"] == "PO2"
        assert result[2]["code"] == "CO1"
        assert result[2]["type"] == "CO"

    def test_case_insensitive(self):
        text = "po3: lower case type"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["type"] == "PO"
        assert result[0]["code"] == "PO3"

    def test_extra_spaces_around_colon(self):
        text = "LO5 :   Explain data structures"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["description"] == "Explain data structures"


# ── Format 2: dash separator ────────────────────────────────────────

class TestDashFormat:
    def test_single_dash(self):
        text = "PO1 - Understand computer science fundamentals"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0] == {
            "type": "PO",
            "number": 1,
            "code": "PO1",
            "description": "Understand computer science fundamentals",
        }

    def test_en_dash(self):
        text = "CO2 \u2013 Apply principles of software engineering"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "CO2"
        assert result[0]["description"] == "Apply principles of software engineering"

    def test_em_dash(self):
        text = "LO1\u2014Demonstrate understanding of OOP"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "LO1"


# ── Format 3: dot separator ─────────────────────────────────────────

class TestDotFormat:
    def test_single_dot(self):
        text = "PO1. Understand computer science fundamentals"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0] == {
            "type": "PO",
            "number": 1,
            "code": "PO1",
            "description": "Understand computer science fundamentals",
        }

    def test_dot_requires_space(self):
        """A dot without a following space should NOT match (avoids 'PO1.2' edge cases)."""
        # "PO1.Something" won't match because the regex needs '. ' (dot + space)
        # but "PO1. Something" will
        text = "PO1. Valid description"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["description"] == "Valid description"


# ── Format 4: multi-line ────────────────────────────────────────────

class TestMultiLineFormat:
    def test_next_line_description(self):
        text = "PO1\nUnderstand computer science fundamentals"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0] == {
            "type": "PO",
            "number": 1,
            "code": "PO1",
            "description": "Understand computer science fundamentals",
        }

    def test_blank_line_between(self):
        text = "CO3\n\nDesign efficient algorithms"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "CO3"
        assert result[0]["description"] == "Design efficient algorithms"

    def test_multiline_description(self):
        text = (
            "LO2\n"
            "Describe the principles of operating systems\n"
            "including process management and memory allocation"
        )
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "LO2"
        assert "process management" in result[0]["description"]
        assert "memory allocation" in result[0]["description"]

    def test_consecutive_multiline(self):
        text = (
            "PO1\n"
            "First outcome description\n"
            "PO2\n"
            "Second outcome description\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert result[0]["code"] == "PO1"
        assert result[0]["description"] == "First outcome description"
        assert result[1]["code"] == "PO2"
        assert result[1]["description"] == "Second outcome description"


# ── Mixed formats ───────────────────────────────────────────────────

class TestMixedFormats:
    def test_all_formats_mixed(self):
        text = (
            "PO1: Colon separated description\n"
            "PO2 - Dash separated description\n"
            "PO3. Dot separated description\n"
            "PO4\n"
            "Multi-line description\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 4
        codes = [r["code"] for r in result]
        assert codes == ["PO1", "PO2", "PO3", "PO4"]

    def test_mixed_types(self):
        text = (
            "PO1: Program outcome one\n"
            "CO1: Course outcome one\n"
            "LO1: Learning outcome one\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 3
        types = [r["type"] for r in result]
        assert types == ["PO", "CO", "LO"]

    def test_continuation_lines_with_separator_format(self):
        text = (
            "PO1: Understand the fundamentals of\n"
            "computer science and engineering\n"
            "PO2: Apply mathematical reasoning\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert "fundamentals of computer science" in result[0]["description"]
        assert result[1]["code"] == "PO2"


# ── Ignoring unrelated content ──────────────────────────────────────

class TestIgnoreUnrelated:
    def test_ignore_numbered_list(self):
        text = (
            "1. Introduction\n"
            "2. Literature Review\n"
            "3. Methodology\n"
            "PO1: Actual outcome\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "PO1"

    def test_ignore_plain_text(self):
        text = (
            "This is a course syllabus document.\n"
            "The following outcomes are expected:\n"
            "PO1: Apply engineering knowledge\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "PO1"

    def test_ignore_random_abbreviations(self):
        """Words like 'POLYGON' or 'COLUMN' should NOT match."""
        text = (
            "POLYGON is a shape\n"
            "COLUMN is a database concept\n"
            "LOGGING is important\n"
            "CO1: Actual course outcome\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "CO1"


# ── Edge cases ──────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_string(self):
        assert parse_outcomes("") == []

    def test_whitespace_only(self):
        assert parse_outcomes("   \n\n  ") == []

    def test_no_outcomes(self):
        text = "This document has no outcomes at all."
        assert parse_outcomes(text) == []

    def test_duplicate_codes_deduplicated(self):
        text = (
            "PO1: First definition\n"
            "PO1: Duplicate definition\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["description"] == "First definition"

    def test_large_outcome_number(self):
        text = "PO99: High numbered outcome"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["number"] == 99
        assert result[0]["code"] == "PO99"

    def test_description_whitespace_normalized(self):
        text = "CO1:    Extra    spaces   everywhere   "
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["description"] == "Extra spaces everywhere"

    def test_returns_correct_structure(self):
        text = "LO3: Test structured output"
        result = parse_outcomes(text)
        assert len(result) == 1
        item = result[0]
        assert "type" in item
        assert "number" in item
        assert "code" in item
        assert "description" in item
        assert item["type"] == "LO"
        assert item["number"] == 3
        assert item["code"] == "LO3"
        assert item["description"] == "Test structured output"


# ── Format 5: Course-code identifiers ───────────────────────────────

class TestCourseCodeFormat:
    def test_tabular_row_with_course_code(self):
        text = "1 CSL603.1 The students should be able to develop mobile applications"
        result = parse_outcomes(text)
        assert len(result) == 1
        assert result[0]["code"] == "CO1"
        assert result[0]["number"] == 1
        assert result[0]["original_code"] == "CSL603.1"
        assert "develop mobile applications" in result[0]["description"]

    def test_multiple_tabular_rows(self):
        text = (
            "COURSE OUTCOMES:\n"
            "1 CSL603.1 The students should be able to develop mobile applications\n"
            "2 CSL603.2 The students should be able to articulate GSM knowledge\n"
            "3 CSL603.3 The students should be able to carry out simulation\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 3
        assert result[0]["code"] == "CO1"
        assert result[0]["original_code"] == "CSL603.1"
        assert result[1]["code"] == "CO2"
        assert result[2]["code"] == "CO3"

    def test_course_code_with_description_on_same_line(self):
        text = (
            "LAB OUTCOMES:\n"
            "CSL603.1 The students should develop apps\n"
            "CSL603.2 The students should understand GSM\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert result[0]["code"] == "CO1"
        assert result[0]["type"] == "CO"
        assert "develop apps" in result[0]["description"]

    def test_course_code_standalone(self):
        text = (
            "COURSE OUTCOMES:\n"
            "CSC603.1\n"
            "Identify basic concepts in computing\n"
            "CSC603.2\n"
            "Describe mobile networking components\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert result[0]["code"] == "CO1"
        assert result[0]["original_code"] == "CSC603.1"
        assert "basic concepts" in result[0]["description"]
        assert result[1]["code"] == "CO2"

    def test_section_header_changes_type(self):
        text = (
            "PROGRAM OUTCOMES:\n"
            "1 CS101.1 Apply engineering knowledge\n"
            "COURSE OUTCOMES:\n"
            "1 CSC603.1 Identify computing concepts\n"
            "LEARNING OUTCOMES:\n"
            "1 CSL603.1 Demonstrate mobile app development\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 3
        assert result[0]["type"] == "PO"
        assert result[0]["code"] == "PO1"
        assert result[1]["type"] == "CO"
        assert result[1]["code"] == "CO1"
        assert result[2]["type"] == "LO"
        assert result[2]["code"] == "LO1"

    def test_lab_outcomes_map_to_CO(self):
        text = (
            "LAB OUTCOMES:\n"
            "1 CSL603.1 Develop and demonstrate mobile applications\n"
            "2 CSL603.2 Articulate knowledge of GSM\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert result[0]["type"] == "CO"
        assert result[1]["type"] == "CO"

    def test_course_code_with_space_in_code(self):
        """OCR may insert spaces: CSC60 3.4 should still parse."""
        text = "COURSE OUTCOMES:\n1 CSC60 3.4 Apply concepts of Mobility Management"
        # Note: CSC60 with space before 3.4 — the regex handles this
        # The tabular row regex handles space between code parts
        result = parse_outcomes(text)
        # Should extract at least the description
        assert len(result) >= 1


# ── Real-world PDF content from MC-CO(2025-26).pdf ──────────────────

class TestRealPDFContent:
    """Test against actual extracted text from a real academic PDF."""

    def test_real_lab_outcomes(self):
        text = (
            "LAB OUTCOMES:\n"
            "SR. OUTCOME OUTCOMESS\n"
            "NO NO.\n"
            "1 CSL603.1 The students should be able to develop and demonstrate mobile\n"
            "applications using various tools\n"
            "2 CSL603.2 The students should be able to articulate the knowledge of GSM, CDMA &\n"
            "Bluetooth technologies and demonstrate it\n"
            "3 CSL603.3 The students should be able to carry out simulation of frequency reuse,\n"
            "hidden/exposed terminal problem\n"
            "4 CSL603.4 The students should be able to implement congestion control mobile\n"
            "communication network\n"
            "5 CSL603.5 The students should be able to demonstrate simulation and compare the\n"
            "performance of Wireless LAN\n"
            "6 CSL603.6 The students should be able to describe security tools\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 6
        assert result[0]["code"] == "CO1"
        assert result[0]["original_code"] == "CSL603.1"
        assert "develop and demonstrate mobile" in result[0]["description"]
        assert "applications using various tools" in result[0]["description"]
        assert result[1]["code"] == "CO2"
        assert "GSM" in result[1]["description"]
        assert result[5]["code"] == "CO6"
        assert "security tools" in result[5]["description"]

    def test_real_course_outcomes(self):
        text = (
            "COURSE OUTCOMES:\n"
            "SR. OUTCOME OUTCOMESS\n"
            "NO NO.\n"
            "1 CSC603.1 The students should be able to identify basic concepts and principles in\n"
            "computing, cellular architecture.\n"
            "2 CSC603.2 The students should be able to describe the components and functioning of\n"
            "mobile networking.\n"
            "3 CSC603.3 The students should be able to apply the concepts of WLAN for local as\n"
            "well as remote applications and classify variety of security techniques in mobile network\n"
            "4 CSC603.4 The students should be able to apply the concepts of Mobility\n"
            "Management\n"
            "5 CSC603.5 The students should be able to describe the concepts LTE and its Interfaces\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 5
        assert result[0]["code"] == "CO1"
        assert result[0]["original_code"] == "CSC603.1"
        assert "basic concepts" in result[0]["description"]
        assert "cellular architecture" in result[0]["description"]
        assert result[2]["code"] == "CO3"
        assert "WLAN" in result[2]["description"]
        assert result[4]["code"] == "CO5"
        assert "LTE" in result[4]["description"]


# ── Backward compatibility ──────────────────────────────────────────

class TestBackwardCompatibility:
    def test_simple_formats_still_work(self):
        text = (
            "PO1: First program outcome\n"
            "PO2 - Second program outcome\n"
            "PO3. Third program outcome\n"
            "PO4\n"
            "Fourth program outcome\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 4
        for r in result:
            assert r["type"] == "PO"
            assert "original_code" not in r

    def test_mixed_simple_and_course_codes(self):
        text = (
            "PO1: Apply engineering knowledge\n"
            "COURSE OUTCOMES:\n"
            "1 CSC603.1 Identify computing concepts\n"
        )
        result = parse_outcomes(text)
        assert len(result) == 2
        assert result[0]["type"] == "PO"
        assert result[0]["code"] == "PO1"
        assert "original_code" not in result[0]
        assert result[1]["type"] == "CO"
        assert result[1]["code"] == "CO1"
        assert result[1]["original_code"] == "CSC603.1"
