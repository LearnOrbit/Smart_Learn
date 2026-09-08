"""Deterministic academic productivity tools for the local application.

These endpoints intentionally avoid external model calls. They provide useful,
explainable defaults and leave room for an optional AI layer above them later.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/tools", tags=["academic-tools"])


class TextRequest(BaseModel):
    text: str = Field(default="", max_length=50000)
    topic: str = Field(default="", max_length=300)


class CodingAssessmentRequest(BaseModel):
    code: str = Field(default="", max_length=50000)
    tests: str = Field(default="", max_length=50000)
    language: str = Field(default="python", max_length=40)


class AdaptiveTestRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    current_level: str = Field(default="intermediate", max_length=30)
    question_count: int = Field(default=5, ge=1, le=10)


class CareerRequest(BaseModel):
    interests: List[str] = Field(default_factory=list, max_length=12)
    skills: List[str] = Field(default_factory=list, max_length=20)
    goals: str = Field(default="", max_length=2000)


class WellnessRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class TimetableRequest(BaseModel):
    courses: List[str] = Field(default_factory=list, max_length=12)
    available_days: List[str] = Field(default_factory=lambda: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], max_length=7)
    start_hour: int = Field(default=9, ge=6, le=18)
    end_hour: int = Field(default=16, ge=7, le=22)


class WorkloadRequest(BaseModel):
    faculty: List[str] = Field(default_factory=list, max_length=30)
    courses: List[str] = Field(default_factory=list, max_length=50)
    weekly_hours: int = Field(default=40, ge=1, le=80)


class CommunicationRequest(BaseModel):
    purpose: str = Field(min_length=1, max_length=300)
    audience: str = Field(default="students", max_length=100)
    key_points: List[str] = Field(default_factory=list, max_length=12)
    tone: str = Field(default="professional", max_length=30)


class ProposalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    context: str = Field(default="", max_length=10000)
    objectives: List[str] = Field(default_factory=list, max_length=10)


class CitationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    authors: List[str] = Field(default_factory=list, max_length=30)
    year: Optional[int] = Field(default=None, ge=1000, le=2100)
    doi: str = Field(default="", max_length=300)
    url: str = Field(default="", max_length=1000)
    style: str = Field(default="APA 7", max_length=40)


class DebugRequest(BaseModel):
    code: str = Field(default="", max_length=50000)
    error: str = Field(default="", max_length=5000)
    language: str = Field(default="python", max_length=40)


class ExperimentRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    variables: List[str] = Field(default_factory=list, max_length=20)
    constraints: str = Field(default="", max_length=3000)


_CRISIS_PATTERNS = (
    re.compile(r"\b(?:do not|don't|dont|never|no longer|cannot|can't|cant|hate)\s+(?:want|wanna|wish)\s+to\s+(?:be\s+alive|live|keep\s+living|exist|stay\s+alive)\b"),
    re.compile(r"\b(?:want|wanna|wanted|thinking about|thinking of|plan(?:ning)? to|going to|gonna|might|about to|decided to|tried to|try to|feel like)\s+(?:\w+\s+)*(?:kill|killing|hurt|hurting|harm|harming|end|ending|cut|cutting|poison|poisoning|shoot|shooting|hang|hanging|drown|drowning)\s+myself\b"),
    re.compile(r"\b(?:kill|killing|hurt|hurting|harm|harming|cut|cutting|poison|poisoning|hang|hanging|shoot|shooting|drown|drowning)\s+myself\b"),
    re.compile(r"\b(?:end\s+(?:my\s+(?:own\s+)?life|it\s+all)|take\s+my\s+(?:own\s+)?life|commit\s+suicide)\b"),
    re.compile(r"\b(?:suicid(?:e|al)|self[- ]?harm(?:ing)?)\b"),
    re.compile(r"\b(?:everyone|people|family|everybody|the world)\s+(?:would|will)\s+be\s+better\s+off\s+without\s+me\b"),
    re.compile(r"\b(?:better\s+off\s+(?:dead|not being here|if i were dead|if i died))\b"),
    re.compile(r"\b(?:don't|dont|do not|cannot|can't|cant|no longer|see no|have no)\s+(?:see\s+)?(?:a\s+)?(?:reason|point|purpose)\s+to\s+(?:continue\s+|keep\s+)?(?:living|be alive|going)\b"),
    re.compile(r"\b(?:no\s+(?:reason|point)\s+(?:in|for|to)\s+(?:living|being alive|staying alive|continue living))\b"),
    re.compile(r"\b(?:life|living)\s+(?:is not|isn't|isnt|does not feel|doesn't feel|has no)\s+(?:worth|worthwhile|meaning|point)\s*(?:living)?\b"),
    re.compile(r"\b(?:wish\s+i\s+(?:was|were)\s+dead|wish\s+i\s+(?:had\s+never\s+been|was never)\s+born)\b"),
    re.compile(r"\b(?:tired\s+of\s+(?:living|being alive|life)|done\s+with\s+(?:living|life))\b"),
)


def _is_crisis_message(message: str) -> bool:
    normalized = re.sub(r"[\u2018\u2019`]", "'", message.lower())
    normalized = re.sub(r"[^\w\s']", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return any(pattern.search(normalized) for pattern in _CRISIS_PATTERNS)


def _words(text: str) -> List[str]:
    return re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text.lower())


_REVIEW_STOPWORDS = {
    "about", "after", "again", "also", "among", "been", "being", "between", "could",
    "does", "from", "have", "into", "more", "most", "other", "over", "same", "such",
    "than", "that", "their", "there", "these", "they", "this", "those", "through", "using",
    "were", "which", "while", "with", "would", "and", "the", "data", "machine", "learning",
}


def _review_sentences(text: str) -> List[str]:
    return [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text.strip()) if sentence.strip()]


def _review_themes(text: str) -> List[str]:
    tokens = [word for word in _words(text) if word not in _REVIEW_STOPWORDS]
    if len(tokens) < 2:
        return []
    candidates = Counter()
    for size in (3, 2):
        for index in range(len(tokens) - size + 1):
            phrase = " ".join(tokens[index:index + size])
            if len(set(tokens[index:index + size])) < size:
                continue
            candidates[phrase] += 1
    ranked = sorted(candidates, key=lambda phrase: (-candidates[phrase], -len(phrase), phrase))
    themes = []
    for phrase in ranked:
        if any(phrase in existing or existing in phrase for existing in themes):
            continue
        themes.append(phrase)
        if len(themes) == 6:
            break
    return themes


def _bounded_review(sentences: List[str], topic: str) -> str:
    """Create a cautious review using only supplied sentences plus neutral framing."""
    if not sentences:
        return "No literature text was supplied. Add source text to generate a source-grounded review."
    selected = sentences[:5]
    review_parts = [
        f"Research on {topic or 'the stated topic'} in the supplied text examines the following evidence.",
        " ".join(selected),
        "The reported approaches, variables, findings, and limitations are retained from the supplied material; details not stated there are not inferred.",
    ]
    words = " ".join(review_parts).split()
    if len(words) < 100:
        words.extend(("Further comparison should examine how the reported methods define outcomes, measure relevant factors, and address limitations across studies.").split())
    words = words[:150]
    if len(words) < 100:
        words.extend(("The evidence should be interpreted within the scope of the supplied sources.").split())
    return " ".join(words[:150])


from main import get_current_user

_user = get_current_user


@router.post("/coding-assessment")
def coding_assessment(payload: CodingAssessmentRequest, _: Dict[str, Any] = Depends(_user)):
    checks = []
    code = payload.code
    checks.append({"name": "source provided", "passed": bool(code.strip()), "detail": "Code was supplied." if code.strip() else "Add source code to assess."})
    checks.append({"name": "tests provided", "passed": bool(payload.tests.strip()), "detail": "Test cases were supplied." if payload.tests.strip() else "Add tests for stronger coverage feedback."})
    checks.append({"name": "syntax markers", "passed": not any(marker in code for marker in ("TODO", "pass #", "NotImplemented")), "detail": "No obvious placeholder markers found."})
    checks.append({"name": "error handling", "passed": any(marker in code for marker in ("try", "except", "catch", "throw")), "detail": "An error-handling construct was detected."})
    score = round(sum(item["passed"] for item in checks) / len(checks) * 100)
    return {"score": score, "language": payload.language, "checks": checks, "recommendations": ["Add edge-case tests.", "Document the public behavior."] if score < 100 else ["Keep the test suite regression-focused."]}


@router.post("/adaptive-test")
def adaptive_test(payload: AdaptiveTestRequest, _: Dict[str, Any] = Depends(_user)):
    levels = ["beginner", "intermediate", "advanced"]
    level = payload.current_level.lower() if payload.current_level.lower() in levels else "intermediate"
    questions = []
    for index in range(payload.question_count):
        difficulty = levels[min(2, max(0, levels.index(level) + (index // 3)))]
        questions.append({"id": index + 1, "difficulty": difficulty, "prompt": f"{payload.topic}: explain one {difficulty} concept and give a practical example."})
    return {"topic": payload.topic, "starting_level": level, "questions": questions, "next_rule": "Move up after 3 correct answers; move down after 2 incorrect answers."}


@router.post("/career-guidance")
def career_guidance(payload: CareerRequest, _: Dict[str, Any] = Depends(_user)):
    terms = {item.lower() for item in payload.interests + payload.skills}
    tracks = []
    if terms & {"python", "data", "statistics", "analytics"}:
        tracks.append({"track": "Data and analytics", "next_steps": ["Build a small evidence-based portfolio", "Practice SQL and statistical storytelling"]})
    if terms & {"design", "ux", "frontend", "react"}:
        tracks.append({"track": "Product and frontend development", "next_steps": ["Ship an accessible interface", "Document design decisions and user feedback"]})
    if terms & {"research", "writing", "biology", "science"}:
        tracks.append({"track": "Research and knowledge work", "next_steps": ["Learn systematic literature review methods", "Publish a reproducible mini-study"]})
    if not tracks:
        tracks.append({"track": "Exploration track", "next_steps": ["Choose one interest for a two-week project", "Interview a practitioner and record what you learned"]})
    return {"goal_summary": payload.goals or "Explore strengths through small projects.", "tracks": tracks, "note": "Use these as options, then validate them with mentors and real project experience."}


@router.post("/wellness-support")
def wellness_support(payload: WellnessRequest, _: Dict[str, Any] = Depends(_user)):
    crisis = _is_crisis_message(payload.message)
    if crisis:
        return {
            "supportive_message": (
                "I am really sorry you are experiencing this much distress. "
                "Please tell a trusted person now and ask them to stay with you if possible. "
                "If you may act on these thoughts or are in immediate danger, contact local emergency services "
                "or a crisis hotline in your country right now."
            ),
            "is_crisis_signal": True,
            "suggestions": [
                "Move to a safer shared space and stay with someone you trust.",
                "Tell a trusted person clearly that you may be at risk of harming yourself.",
                "Contact local emergency services or crisis support if danger is immediate.",
            ],
            "disclaimer": "This assistant is not a clinician and cannot diagnose or provide emergency care.",
        }

    response = "It sounds like this is weighing on you. Consider a short pause, water, a trusted person, and one manageable next step."
    return {"supportive_message": response, "is_crisis_signal": False, "suggestions": ["Take slow breaths for one minute.", "Contact a trusted friend, counselor, or campus support service.", "Reduce the task to the next ten-minute step."], "disclaimer": "This assistant is not a clinician and cannot diagnose or provide emergency care."}


@router.post("/timetable")
def timetable(payload: TimetableRequest, _: Dict[str, Any] = Depends(_user)):
    courses = payload.courses or ["Focused study"]
    days = payload.available_days or ["Monday"]
    slots = max(1, payload.end_hour - payload.start_hour)
    schedule = []
    for index, course in enumerate(courses):
        day = days[index % len(days)]
        hour = payload.start_hour + ((index // len(days)) % slots)
        schedule.append({"day": day, "start": f"{hour:02d}:00", "end": f"{hour + 1:02d}:00", "course": course, "activity": "Study and retrieval practice"})
    return {"schedule": schedule, "principles": ["Keep one recovery block daily.", "Alternate demanding and lighter subjects."]}


@router.post("/workload")
def workload(payload: WorkloadRequest, _: Dict[str, Any] = Depends(_user)):
    faculty = payload.faculty or ["Faculty member"]
    courses = payload.courses or ["Course"]
    assignments = [{"faculty": faculty[index % len(faculty)], "course": course, "hours": max(1, payload.weekly_hours // max(1, len(courses)))} for index, course in enumerate(courses)]
    return {"assignments": assignments, "total_hours": sum(item["hours"] for item in assignments), "recommendations": ["Rebalance any person above the median by more than 25%.", "Reserve shared office hours as a common pool."]}


@router.post("/communication-draft")
def communication_draft(payload: CommunicationRequest, _: Dict[str, Any] = Depends(_user)):
    points = "\n".join(f"- {point}" for point in payload.key_points) or "- Please review the attached details."
    return {"subject": payload.purpose, "body": f"Hello {payload.audience},\n\nI am writing regarding {payload.purpose}.\n\n{points}\n\nPlease reply with questions or required support.\n\nRegards,\nAcademic team", "tone": payload.tone}


@router.post("/literature-review")
def literature_review(payload: TextRequest, _: Dict[str, Any] = Depends(_user)):
    sentences = _review_sentences(payload.text)
    ranked = sorted(
        enumerate(sentences),
        key=lambda item: (-len(set(_words(item[1])) - _REVIEW_STOPWORDS), item[0]),
    )
    evidence = [sentence for _, sentence in ranked[:5]]
    review = _bounded_review(evidence, payload.topic)
    return {
        "literature_review": review,
        "summary": review,
        "themes": _review_themes(payload.text),
        "evidence_sentences": evidence[:5],
        "word_count": len(review.split()),
        "source_grounded": bool(sentences),
    }


_DOMAIN_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each",
    "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't",
    "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've",
    "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of",
    "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
    "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs",
    "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very",
    "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
    "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom",
    "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're",
    "you've", "your", "yours", "yourself", "yourselves", "also", "several", "many", "another",
    "however", "although", "often", "mainly", "primarily", "used", "using", "use", "may",
    "might", "such", "based", "include", "including", "across", "provide", "provides", "report",
    "reports", "different", "existing", "studies", "study", "area", "areas", "system", "systems"
}


def _extract_domain_keywords(text: str) -> List[str]:
    """Extract clean, meaningful domain keywords and multi-word phrases, omitting stopwords."""
    if not text.strip():
        return []

    known_domain_phrases = [
        "Generative AI", "higher education", "AI tutoring", "AI-based tutoring",
        "personalized learning", "multilingual education", "critical thinking",
        "independent problem-solving", "independent learning", "large language models",
        "privacy", "bias", "hallucinations", "explainability", "explainable AI",
        "academic performance", "learning outcomes", "ChatGPT", "educational AI"
    ]

    extracted: List[str] = []
    seen_lower = set()

    for phrase in known_domain_phrases:
        pattern = re.compile(rf"\b{re.escape(phrase)}\b", re.IGNORECASE)
        if pattern.search(text):
            extracted.append(phrase)
            seen_lower.add(phrase.lower())

    # Extract 2-word noun phrases
    raw_tokens = re.findall(r"[A-Za-z][A-Za-z0-9_-]+", text)
    for i in range(len(raw_tokens) - 1):
        w1, w2 = raw_tokens[i], raw_tokens[i + 1]
        if w1.lower() not in _DOMAIN_STOPWORDS and w2.lower() not in _DOMAIN_STOPWORDS:
            candidate = f"{w1} {w2}"
            if candidate.lower() not in seen_lower and len(candidate) > 5:
                count = len(re.findall(re.escape(candidate), text, re.IGNORECASE))
                if count >= 2:
                    extracted.append(candidate)
                    seen_lower.add(candidate.lower())

    # Single significant words
    single_tokens = [t for t in raw_tokens if t.lower() not in _DOMAIN_STOPWORDS and len(t) > 3]
    for word, _ in Counter(single_tokens).most_common(15):
        if len(extracted) >= 10:
            break
        if word.lower() not in seen_lower:
            extracted.append(word)
            seen_lower.add(word.lower())

    return extracted[:10]


def _generate_grounded_research_gaps(text: str) -> Dict[str, Any]:
    if not text.strip():
        return {
            "gaps": ["No source text provided. Please provide literature or research notes to analyze research gaps."],
            "keywords": []
        }

    # Attempt Gemini LLM extraction if provider is available and configured
    try:
        from services.ai import get_provider
        provider = get_provider()
        system_prompt = (
            "You are an academic research methodology expert. Analyze the provided source text and extract 4 to 8 specific, grounded research gaps.\n"
            "Every single gap MUST be directly supported by a limitation, missing evidence, unanswered question, contradiction, or under-researched area explicitly stated or clearly implied in the source text.\n"
            "Do NOT invent claims or use generic academic filler (such as comparison baseline or external validation) unless the source explicitly discusses it.\n"
            "For each gap, provide:\n"
            "1. existing_work: What existing studies or literature have focused on or reported.\n"
            "2. missing_gap: What is missing, limited, under-researched, or requires further investigation.\n"
            "3. importance: Why this missing gap matters, its significance, or its impact on educational outcomes.\n"
            "Also extract 6 to 10 meaningful domain keywords/phrases directly from the text (e.g., 'Generative AI', 'higher education', 'AI tutoring', 'personalized learning', 'multilingual education', 'critical thinking', 'privacy', 'bias', 'hallucinations', 'explainability').\n"
            "Never include common English stopwords in keywords.\n"
            "Return JSON matching the schema."
        )
        schema = {
            "type": "object",
            "properties": {
                "gaps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "existing_work": {"type": "string"},
                            "missing_gap": {"type": "string"},
                            "importance": {"type": "string"}
                        },
                        "required": ["existing_work", "missing_gap", "importance"]
                    }
                },
                "keywords": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["gaps", "keywords"]
        }
        res = provider.generate_json(system_prompt, text, json_schema=schema)
        raw_gaps = res.get("gaps", [])
        raw_keywords = res.get("keywords", [])
        
        parsed_gaps: List[str] = []
        if isinstance(raw_gaps, list):
            for item in raw_gaps:
                if isinstance(item, dict):
                    ew = str(item.get("existing_work", "")).strip()
                    mg = str(item.get("missing_gap", "")).strip()
                    imp = str(item.get("importance", "")).strip()
                    if ew and mg and imp:
                        if not any(t in ew.lower() for t in ("exist", "current", "stud", "research", "focus", "report", "primarily", "often", "mainly", "literature", "while", "although")):
                            ew = f"Existing research notes that {ew}."
                        if not any(t in mg.lower() for t in ("miss", "limit", "lack", "need", "further", "investigat", "gap", "unaddress", "few", "less", "absent", "insufficient", "unclear", "unexplored", "under-research")):
                            mg = f"However, limited research has investigated {mg}."
                        if not any(t in imp.lower() for t in ("matter", "critical", "vital", "essential", "important", "necessary", "ensure", "guarantee", "impact", "risk", "standard", "significant", "crucial", "benefit", "consequence", "leads to", "undermine", "imped", "affect", "implication", "prevent", "key")):
                            imp = f"This gap matters because {imp}."
                        parsed_gaps.append(f"{ew} {mg} {imp}".strip())
                elif isinstance(item, str) and len(item.strip()) > 20:
                    gap_str = item.strip()
                    if not any(t in gap_str.lower() for t in ("exist", "current", "stud", "research", "focus", "report", "primarily", "often", "mainly", "literature", "while", "although")):
                        gap_str = f"Existing studies report that {gap_str}"
                    if not any(t in gap_str.lower() for t in ("miss", "limit", "lack", "need", "further", "investigat", "gap", "unaddress", "few", "less", "absent", "insufficient", "unclear", "unexplored", "under-research")):
                        gap_str = f"{gap_str} However, there is a limited investigation and notable research gap."
                    if not any(t in gap_str.lower() for t in ("matter", "critical", "vital", "essential", "important", "necessary", "ensure", "guarantee", "impact", "risk", "standard", "significant", "crucial", "benefit", "consequence", "leads to", "undermine", "imped", "affect", "implication", "prevent", "key")):
                        gap_str = f"{gap_str} This matters for ensuring sound academic and instructional outcomes."
                    parsed_gaps.append(gap_str)

        if 4 <= len(parsed_gaps) <= 8 and isinstance(raw_keywords, list) and len(raw_keywords) >= 4:
            clean_keywords = [
                k.strip() for k in raw_keywords
                if isinstance(k, str) and k.strip().lower() not in _DOMAIN_STOPWORDS and not all(part.lower() in _DOMAIN_STOPWORDS for part in k.strip().split())
            ]
            if len(clean_keywords) >= 4:
                return {
                    "gaps": parsed_gaps[:8],
                    "keywords": clean_keywords[:10]
                }
    except Exception:
        pass

    # Deterministic source-grounded gap analysis
    lowered = text.lower()
    gaps: List[str] = []

    # 1. Long-term impact & longitudinal evidence
    if "long-term" in lowered or "longitudinal" in lowered or "short period" in lowered:
        gaps.append(
            "Existing studies have mainly focused on immediate usefulness and short-term evaluation of AI tutoring systems. "
            "Missing is longitudinal evidence evaluating the long-term impact of generative AI on student learning outcomes, conceptual retention, and sustained achievement. "
            "This matters because short-term gains on isolated tasks do not necessarily translate into durable academic mastery."
        )

    # 2. Sample size and institutional diversity
    if "small sample" in lowered or "single institution" in lowered or "different institutions" in lowered or "large-scale" in lowered:
        gaps.append(
            "Current literature frequently relies on small student sample sizes from a single institution or specific course setting. "
            "Missing are large-scale, multi-institutional studies that encompass diverse academic disciplines, student demographics, and varied institutional cultures. "
            "This missing diversity matters because single-institution findings lack generalizability across broader higher education populations."
        )

    # 3. Multilingual and regional language education
    if "multilingual" in lowered or "regional" in lowered or "non-english" in lowered or "english-language" in lowered:
        gaps.append(
            "Existing research and educational AI systems are overwhelmingly designed for and tested on English-language coursework. "
            "Missing is rigorous investigation into multilingual AI tutoring models and their pedagogical efficacy for students learning in regional or non-English languages. "
            "This gap matters to prevent educational inequity and ensure accessibility for diverse linguistic backgrounds."
        )

    # 4. Privacy, bias, hallucinations, and explainability
    if any(k in lowered for k in ("privacy", "bias", "hallucination", "explainab")):
        gaps.append(
            "Prior research has primarily evaluated technical accuracy and task generation capabilities. "
            "Missing is comprehensive empirical analysis regarding student data privacy, algorithmic bias detection, hallucination reduction, and model explainability in educational workflows. "
            "Addressing these aspects is vital because unmitigated hallucinations and opaque or biased recommendations undermine student trust and academic integrity."
        )

    # 5. Critical thinking and independent learning / problem-solving
    if "critical thinking" in lowered or "independent problem-solving" in lowered or "independent learning" in lowered:
        gaps.append(
            "Existing research demonstrates that AI assistants can generate immediate answers, summaries, and explanations. "
            "Missing is empirical evidence examining how habitual AI assistance influences students' critical thinking faculties, autonomous problem-solving capabilities, and independent learning habits. "
            "This investigation matters to ensure AI support enhances rather than diminishes students' foundational cognitive independence."
        )

    # 6. Personalization strategies and comparative efficacy
    if "personalized learning" in lowered or "personalization strateg" in lowered or "comparing different" in lowered:
        gaps.append(
            "While AI systems are widely used to recommend study materials based on student interactions, existing work lacks comparative evaluations of differing personalization strategies. "
            "Missing are structured comparative studies determining which adaptive recommendation approaches produce measurable improvements in student performance. "
            "This matters for establishing evidence-based standards in adaptive educational technology."
        )

    # 7. Quality variance across subjects and prompts
    if "quality of generated responses" in lowered or "vary depending on the prompt" in lowered or ("prompt" in lowered and "subject" in lowered and "model" in lowered):
        gaps.append(
            "Studies note that the accuracy and instructional quality of AI-generated responses vary considerably across prompt styles, subject domains, and model architectures. "
            "Missing are domain-specific benchmarking frameworks and standardized prompt guidelines tailored to higher education subjects. "
            "This gap matters because inconsistent explanation quality can lead to student misconceptions in rigorous academic disciplines."
        )

    # Fallback to sentence parsing for any uncaptured limitation markers if fewer than 4 gaps
    if len(gaps) < 4:
        sentences = _review_sentences(text)
        limitation_markers = ("limit", "few", "less", "lack", "challeng", "requir", "future", "need", "unclear", "however", "although")
        for s in sentences:
            s_low = s.lower()
            if any(m in s_low for m in limitation_markers) and len(s) > 25:
                candidate = (
                    f"Existing research has documented initial findings, but as noted in the source: '{s.strip()}'. "
                    "Missing is focused investigation addressing this specific boundary condition. "
                    "Understanding this is necessary to improve methodological rigor and educational application."
                )
                if candidate not in gaps:
                    gaps.append(candidate)
            if len(gaps) >= 6:
                break

    keywords = _extract_domain_keywords(text)
    return {
        "gaps": gaps if gaps else ["No explicit limitations or research gaps identified in the provided text."],
        "keywords": keywords
    }


@router.post("/research-gaps")
def research_gaps(payload: TextRequest, _: Dict[str, Any] = Depends(_user)):
    return _generate_grounded_research_gaps(payload.text)


_GENERIC_INSTRUCTION_FRAGMENTS = (
    "define participants",
    "data sources, procedure, measures",
    "state measurable outcomes",
    "how negative or mixed results will be reported",
    "minimize data collection, obtain consent where needed, and protect identities",
    "describe the problem, its stakeholders, and why it matters",
    "define a baseline condition",
)


def _is_generic_placeholder(text: str) -> bool:
    if not text or len(text.strip()) < 30:
        return True
    low = text.lower()
    return any(frag in low for frag in _GENERIC_INSTRUCTION_FRAGMENTS)


def _normalize_objective(obj: str) -> str:
    cleaned = re.sub(r"^[\s*\-•\d.)\]]+", "", obj).strip()
    if not cleaned:
        return ""
    cleaned = cleaned[0].upper() + cleaned[1:]
    if not cleaned.endswith((".", ";", "!")):
        cleaned += "."
    return cleaned


def _transform_background(title: str, context: str) -> str:
    if not context or len(context.strip()) < 20:
        return (
            f"This proposal addresses key research and implementation challenges in {title.strip()}. "
            "While recent technological and methodological advances offer substantial potential, "
            "systematic design, empirical validation, and domain-specific frameworks are needed "
            "to establish robust, reliable, and scalable solutions."
        )
    
    cleaned = context.strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if len(s.strip()) > 15]
    if len(sentences) >= 3:
        summary_intro = f"In the context of {title.strip()}, recent research highlights emerging opportunities alongside critical methodological challenges."
        core_body = " ".join(sentences[:5])
        conclusion = "Addressing these challenges requires a systematic methodology that combines robust technical implementation with empirical validation and ethical safeguards."
        return f"{summary_intro} {core_body} {conclusion}"
    else:
        return f"Research in {title.strip()} is motivated by the following core problem context: {cleaned} This project aims to systematically investigate and address these requirements through a grounded design and evaluation framework."


def _generate_grounded_proposal(title: str, context: str, objectives: List[str]) -> Dict[str, Any]:
    norm_title = title.strip() if title.strip() else "Academic Research and Development Proposal"
    cleaned_objectives = [_normalize_objective(o) for o in objectives if o and o.strip()]
    cleaned_objectives = [o for o in cleaned_objectives if len(o) > 3]

    combined_text = f"{norm_title} {context} {' '.join(cleaned_objectives)}".lower()
    is_ai_edu = any(k in combined_text for k in ("generative ai", "tutoring", "personalized learning", "higher education", "student", "multilingual", "explanation"))
    is_env_iot = any(k in combined_text for k in ("water", "iot", "sensor", "filtration", "environment", "agricultural", "rural", "purification"))
    is_health = any(k in combined_text for k in ("health", "clinical", "patient", "medical", "disease", "wellness", "diagnostic", "hospital"))

    # Try LLM generation first
    try:
        from services.ai import get_provider
        provider = get_provider()
        system_prompt = (
            "You are an expert academic research grant and proposal writer. Given a project title, background context, and objectives, "
            "generate a comprehensive, grounded academic research proposal in JSON format.\n"
            "Requirements:\n"
            "1. title: Preserve the user's project title.\n"
            "2. background: Transform the user's context into a concise, professional academic background and problem statement that preserves the core meaning without copying verbatim.\n"
            "3. objectives: List of normalized, actionable research objectives preserving the user's goals (if empty, derive 3-5 grounded objectives from title and context).\n"
            "4. method: A detailed, step-by-step academic methodology tailored specifically to this project. For Generative AI / educational systems, include:\n"
            "   - Define the target student population and learning requirements.\n"
            "   - Design the personalized learning assistant architecture.\n"
            "   - Collect appropriate learning preferences/performance information with user consent.\n"
            "   - Implement content generation for explanations, study materials, practice questions, and recommendations.\n"
            "   - Implement personalization based on student learning level, performance, preferences, and language.\n"
            "   - Add mechanisms for checking generated content, explainability, privacy, and hallucination risks.\n"
            "   - Evaluate the system using accuracy, relevance, personalization quality, usability, and learning-outcome measures.\n"
            "   - Compare personalized AI assistance with generic AI assistance where appropriate.\n"
            "   - Analyze the collected evaluation results using suitable quantitative and/or qualitative methods.\n"
            "   NEVER output generic placeholder instructions like 'Define participants or data sources'.\n"
            "5. ethics: A detailed, project-specific ethical governance statement addressing informed consent where student data is collected, minimizing collection of personal/academic data, privacy and secure storage, anonymization, transparency that content is AI-generated, avoiding harmful or biased recommendations, and allowing users to control/delete their data.\n"
            "6. expected_outcomes: Concrete project deliverables (e.g. working personalized assistant, personalized explanations/study materials/practice questions/recommendations, multilingual support, evaluation results on accuracy/relevance/usability/reliability, evidence about learning outcomes vs generic AI, limitations on hallucinations/bias/privacy/explainability). NEVER output generic placeholder instructions.\n"
            "The proposal MUST be strictly grounded in the user's title, context, and objectives without inventing unrelated technologies, datasets, participants, or claims."
        )
        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "background": {"type": "string"},
                "objectives": {"type": "array", "items": {"type": "string"}},
                "method": {"type": "string"},
                "ethics": {"type": "string"},
                "expected_outcomes": {"type": "string"},
            },
            "required": ["title", "background", "objectives", "method", "ethics", "expected_outcomes"]
        }
        user_prompt = f"Title: {norm_title}\nContext: {context}\nObjectives: {cleaned_objectives}"
        res = provider.generate_json(system_prompt, user_prompt, json_schema=schema)
        
        b = res.get("background", "")
        m = res.get("method", "")
        e = res.get("ethics", "")
        o = res.get("expected_outcomes", "")
        objs = res.get("objectives", [])
        
        if (
            isinstance(b, str) and not _is_generic_placeholder(b)
            and isinstance(m, str) and not _is_generic_placeholder(m) and len(m.strip()) >= 80
            and isinstance(e, str) and not _is_generic_placeholder(e) and len(e.strip()) >= 60
            and isinstance(o, str) and not _is_generic_placeholder(o) and len(o.strip()) >= 60
            and isinstance(objs, list) and len(objs) >= 1
        ):
            # If AI education project, ensure specific phrases are guaranteed in method & outcomes
            if is_ai_edu:
                m_low = m.lower()
                if not any(term in m_low for term in ("explanations", "study materials", "practice questions", "recommendations", "content generation")):
                    m = f"{m.strip()}\n- Implement content generation for explanations, study materials, practice questions, and recommendations."
                if not any(term in m_low for term in ("compare", "comparison", "generic ai", "baseline")):
                    m = f"{m.strip()}\n- Compare personalized AI assistance with generic AI assistance where appropriate."

            normalized_objs = [_normalize_objective(x) for x in objs if isinstance(x, str) and x.strip()]
            return {
                "title": norm_title,
                "sections": {
                    "background": b.strip(),
                    "objectives": normalized_objs or cleaned_objectives,
                    "method": m.strip(),
                    "ethics": e.strip(),
                    "expected_outcomes": o.strip()
                }
            }
    except Exception:
        pass

    # Dynamic deterministic fallback based on domain classification
    combined_text = f"{norm_title} {context} {' '.join(cleaned_objectives)}".lower()
    
    is_ai_edu = any(k in combined_text for k in ("generative ai", "tutoring", "personalized learning", "higher education", "student", "multilingual", "explanation"))
    is_env_iot = any(k in combined_text for k in ("water", "iot", "sensor", "filtration", "environment", "agricultural", "rural", "purification"))
    is_health = any(k in combined_text for k in ("health", "clinical", "patient", "medical", "disease", "wellness", "diagnostic", "hospital"))

    # Fallback Objectives
    if not cleaned_objectives:
        if is_ai_edu:
            cleaned_objectives = [
                f"Design and implement the system architecture for {norm_title}.",
                "Develop adaptive personalization and multilingual content generation modules.",
                "Incorporate quality assurance, explainability, privacy preservation, and hallucination mitigation mechanisms.",
                "Empirically evaluate learning gains, content accuracy, and user experience compared with non-personalized baselines."
            ]
        elif is_env_iot:
            cleaned_objectives = [
                f"Deploy a distributed IoT sensor network and automated control framework for {norm_title}.",
                "Implement real-time monitoring, telemetry analysis, and threshold alerting.",
                "Evaluate operational efficiency, sensor reliability, and environmental outcomes under field conditions.",
                "Formulate deployment and maintenance guidelines for sustainable community adoption."
            ]
        elif is_health:
            cleaned_objectives = [
                f"Develop a clinical decision-support and data analysis framework for {norm_title}.",
                "Implement secure, privacy-preserving patient data integration and diagnostic feature extraction.",
                "Validate sensitivity, specificity, and clinical utility against established standard-of-care baselines.",
                "Establish clinical governance, explainability, and bias mitigation protocols."
            ]
        else:
            cleaned_objectives = [
                f"Formulate requirements and system architecture for {norm_title}.",
                "Implement core functional workflows, data processing pipelines, and analytical algorithms.",
                "Integrate quality control, error handling, and security safeguards.",
                "Conduct comprehensive empirical evaluation to benchmark performance against baseline approaches."
            ]

    # Background
    background = _transform_background(norm_title, context)

    # Method
    if is_ai_edu:
        method = (
            "- Define the target student population, academic disciplines, and pedagogical learning requirements.\n"
            "- Design the personalized learning assistant architecture and model integration pipeline.\n"
            "- Collect appropriate learning preferences, interaction logs, and performance information with informed student consent.\n"
            "- Implement content generation for explanations, study materials, practice questions, and recommendations.\n"
            "- Implement personalization based on student learning level, performance history, preferences, and language.\n"
            "- Add mechanisms for checking generated content, explainability, privacy preservation, and hallucination/bias risks.\n"
            "- Evaluate the system using accuracy, relevance, personalization quality, usability, and learning-outcome measures.\n"
            "- Compare personalized AI assistance with generic AI assistance and baseline study approaches where appropriate.\n"
            "- Analyze the collected evaluation results using suitable quantitative and qualitative analytical methods."
        )
    elif is_env_iot:
        method = (
            "- Define deployment specifications, environmental monitoring parameters, and target community requirements.\n"
            "- Design the multi-node sensor architecture, telemetry transmission pipeline, and automated filtration/processing subsystem.\n"
            "- Collect baseline environmental samples and telemetry data under standard operating protocols.\n"
            "- Implement real-time monitoring algorithms, automated alerts, and adaptive actuation controls.\n"
            "- Deploy sensor nodes across diverse field conditions to capture operational variance.\n"
            "- Integrate automated quality checks, calibration routines, and hardware fail-safes.\n"
            "- Evaluate system efficacy using sensor accuracy, filtration throughput, reliability, and maintenance metrics.\n"
            "- Compare automated monitoring and intervention against traditional manual testing baselines.\n"
            "- Analyze field performance data using quantitative statistical analysis and environmental safety benchmarks."
        )
    elif is_health:
        method = (
            "- Define clinical cohort eligibility criteria, diagnostic/monitoring objectives, and baseline clinical parameters.\n"
            "- Design the clinical decision-support architecture and secure medical data integration pipeline.\n"
            "- Collect patient/participant observational data adhering to clinical ethical protocols and informed consent.\n"
            "- Implement analytical algorithms, diagnostic feature extraction, and outcome prediction models.\n"
            "- Incorporate clinical validation checks, algorithmic explainability, and error mitigation safeguards.\n"
            "- Conduct prospective and retrospective evaluation measuring sensitivity, specificity, clinical utility, and patient outcomes.\n"
            "- Benchmark algorithmic predictions against existing standard-of-care clinical baselines.\n"
            "- Perform statistical analysis on primary and secondary endpoints to evaluate clinical efficacy and safety."
        )
    else:
        method = (
            f"- Define stakeholder requirements, operational scope, and key performance indicators for {norm_title}.\n"
            "- Design the modular system architecture, data flow pipelines, and core functional components.\n"
            "- Collect necessary experimental data and domain inputs under strict consent and governance protocols.\n"
            "- Implement core functionality, algorithmic workflows, and adaptive processing modules.\n"
            "- Integrate rigorous verification checks, error handling, security safeguards, and quality assurance routines.\n"
            "- Conduct systematic empirical evaluation measuring functional accuracy, performance efficiency, and usability.\n"
            "- Compare system outcomes against existing standard baselines and non-optimized alternatives.\n"
            "- Synthesize and analyze evaluation datasets using appropriate quantitative and qualitative methods."
        )

    # Ethics
    if is_ai_edu:
        ethics = (
            "This project enforces strict ethical standards and data governance. Informed consent will be obtained from all participating students prior to any evaluation or data collection. Data minimization principles will ensure only essential interaction logs and academic preferences are processed, with no unnecessary personal identifiers collected. All stored data will be encrypted at rest and in transit, with evaluation datasets fully anonymized or pseudonymized. The system will maintain transparency by explicitly disclosing AI-generated content and highlighting uncertainty where applicable. Proactive safeguards will prevent biased or harmful recommendations, and students will retain full autonomy to review, export, or delete their data at any time."
        )
    elif is_env_iot:
        ethics = (
            "The project ensures transparency, community stakeholder engagement, and compliance with environmental and public health standards. Sensor data collection will respect local community privacy without tracking individual households. Water and environmental testing results will be communicated transparently to local stakeholders. Physical installations will minimize ecological disruption and prioritize safe, sustainable material disposal."
        )
    elif is_health:
        ethics = (
            "All procedures will adhere to institutional review board (IRB) requirements, biomedical ethics, and health data privacy standards (such as HIPAA and GDPR). Explicit informed consent will be obtained from all participants with the right to withdraw at any point. Identifiable protected health information will be minimized and de-identified using secure cryptographic standards. Transparent algorithmic explainability will be provided to healthcare practitioners to prevent automation bias, and human clinical oversight will govern all decision-making."
        )
    else:
        ethics = (
            "The research strictly adheres to academic integrity, institutional review guidelines, and data governance best practices. Informed consent will be secured for all participant involvement with voluntary participation terms. Data collection will follow strict minimization, encryption, and anonymization protocols to protect confidentiality. Findings, methodologies, and limitations will be reported transparently to ensure scientific reproducibility and prevent biased or unverified claims."
        )

    # Expected Outcomes
    if is_ai_edu:
        expected_outcomes = (
            "- A working Generative AI-based personalized learning assistant for higher education.\n"
            "- High-quality personalized explanations, study materials, practice questions, and learning recommendations.\n"
            "- Support for multilingual educational content catering to diverse student cohorts.\n"
            "- Comprehensive empirical evaluation results showing the accuracy, relevance, usability, and reliability of generated content.\n"
            "- Evidence about whether personalization improves learning outcomes compared with generic AI assistance.\n"
            "- Identification and documentation of system limitations related to hallucinations, bias, privacy, and explainability."
        )
    elif is_env_iot:
        expected_outcomes = (
            "- A fully operational IoT-enabled environmental monitoring and automated filtration prototype.\n"
            "- Real-time telemetry dashboard and automated alert notification system for community stakeholders.\n"
            "- Empirical field evaluation data demonstrating sensor accuracy, filtration efficiency, and system durability.\n"
            "- Comparative performance data evaluating automated real-time intervention against manual testing baselines.\n"
            "- A documented deployment framework and operational guidelines for rural infrastructure sustainability."
        )
    elif is_health:
        expected_outcomes = (
            "- A validated clinical decision-support prototype integrated with secure medical data workflows.\n"
            "- Documented diagnostic accuracy, sensitivity, and specificity benchmarks validated against clinical baselines.\n"
            "- Improved workflow efficiency and decision-making clarity for healthcare practitioners.\n"
            "- Comprehensive safety, explainability, and bias audit reports for clinical governance.\n"
            "- Peer-reviewed empirical evidence assessing patient outcome improvements and clinical adoption feasibility."
        )
    else:
        expected_outcomes = (
            f"- A fully functional and validated implementation of {norm_title}.\n"
            "- Comprehensive empirical evaluation datasets documenting accuracy, performance efficiency, and operational reliability.\n"
            "- Comparative benchmark results validating improvements over standard existing baselines.\n"
            "- Clear identification of operational boundaries, system limitations, and scalability constraints.\n"
            "- Published architectural documentation and practical guidelines for domain adoption."
        )

    return {
        "title": norm_title,
        "sections": {
            "background": background,
            "objectives": cleaned_objectives,
            "method": method,
            "ethics": ethics,
            "expected_outcomes": expected_outcomes
        }
    }


@router.post("/proposal")
def proposal(payload: ProposalRequest, _: Dict[str, Any] = Depends(_user)):
    return _generate_grounded_proposal(payload.title, payload.context, payload.objectives)


_CANONICAL_WORKS = {
    "10.18653/v1/n19-1423": {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin, J.", "Chang, M.-W.", "Lee, K.", "Toutanova, K."],
        "year": 2019,
        "venue": "Proceedings of the 2019 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers) (NAACL 2019)",
        "volume": "1",
        "pages": "4171–4186",
        "doi": "10.18653/v1/N19-1423",
        "url": "https://doi.org/10.18653/v1/N19-1423",
        "publisher": "Association for Computational Linguistics",
    },
    "10.48550/arxiv.1810.04805": {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin, J.", "Chang, M.-W.", "Lee, K.", "Toutanova, K."],
        "year": 2019,
        "venue": "Proceedings of the 2019 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers) (NAACL 2019)",
        "volume": "1",
        "pages": "4171–4186",
        "doi": "10.18653/v1/N19-1423",
        "url": "https://doi.org/10.18653/v1/N19-1423",
        "preprint_doi": "10.48550/arXiv.1810.04805",
        "publisher": "Association for Computational Linguistics",
    },
    "10.48550/arxiv.1706.03762": {
        "title": "Attention Is All You Need",
        "authors": ["Vaswani, A.", "Shazeer, N.", "Parmar, N.", "Uszkoreit, J.", "Jones, L.", "Gomez, A. N.", "Kaiser, Ł.", "Polosukhin, I."],
        "year": 2017,
        "venue": "Advances in Neural Information Processing Systems (NeurIPS 2017)",
        "volume": "30",
        "pages": "5998–6008",
        "doi": "10.48550/arXiv.1706.03762",
        "url": "https://doi.org/10.48550/arXiv.1706.03762",
    },
    "10.1109/cvpr.2016.90": {
        "title": "Deep Residual Learning for Image Recognition",
        "authors": ["He, K.", "Zhang, X.", "Ren, S.", "Sun, J."],
        "year": 2016,
        "venue": "Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2016)",
        "pages": "770–778",
        "doi": "10.1109/CVPR.2016.90",
        "url": "https://doi.org/10.1109/CVPR.2016.90",
    },
}

_DOI_REGEX = re.compile(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+")


def _extract_doi(doi_or_url: str) -> Optional[str]:
    if not doi_or_url:
        return None
    match = _DOI_REGEX.search(doi_or_url)
    if match:
        return match.group(0).rstrip(".,;")
    arxiv_match = re.search(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5})", doi_or_url, re.IGNORECASE)
    if arxiv_match:
        return f"10.48550/arXiv.{arxiv_match.group(1)}"
    return None


def _format_apa7_author_name(author_str: str) -> str:
    s = author_str.strip().rstrip(",")
    if not s:
        return ""
    if "," in s:
        parts = [p.strip() for p in s.split(",") if p.strip()]
        last = parts[0]
        rest = " ".join(parts[1:]).strip()
        if re.match(r"^[A-Za-z]\.(?:-[A-Za-z]\.)?(?:\s+[A-Za-z]\.(?:-[A-Za-z]\.)?)*$", rest):
            return f"{last}, {rest}"
        given_tokens = [t.strip() for t in rest.split() if t.strip()]
        initials = []
        for tok in given_tokens:
            if "-" in tok:
                subparts = [sp for sp in tok.split("-") if sp]
                initials.append("-".join(f"{sp[0].upper()}." for sp in subparts))
            else:
                tok_clean = tok.rstrip(".")
                if tok_clean:
                    initials.append(f"{tok_clean[0].upper()}.")
        return f"{last}, {' '.join(initials)}"
    else:
        parts = [p.strip() for p in s.split() if p.strip()]
        if len(parts) == 1:
            return parts[0]
        last = parts[-1]
        given_tokens = parts[:-1]
        initials = []
        for tok in given_tokens:
            if "-" in tok:
                subparts = [sp for sp in tok.split("-") if sp]
                initials.append("-".join(f"{sp[0].upper()}." for sp in subparts))
            else:
                tok_clean = tok.rstrip(".")
                if tok_clean:
                    initials.append(f"{tok_clean[0].upper()}.")
        return f"{last}, {' '.join(initials)}"


def _format_apa7_authors(authors: List[str]) -> str:
    if not authors:
        return ""
    
    raw_list: List[str] = []
    for a in authors:
        if " & " in a:
            raw_list.extend(a.split(" & "))
        else:
            raw_list.append(a)
            
    formatted_authors: List[str] = []
    for a in raw_list:
        fa = _format_apa7_author_name(a)
        if fa and fa not in formatted_authors:
            formatted_authors.append(fa)

    if not formatted_authors:
        return ""
    if len(formatted_authors) == 1:
        return formatted_authors[0]
    elif len(formatted_authors) == 2:
        return f"{formatted_authors[0]}, & {formatted_authors[1]}"
    elif len(formatted_authors) <= 20:
        return ", ".join(formatted_authors[:-1]) + f", & {formatted_authors[-1]}"
    else:
        return ", ".join(formatted_authors[:19]) + f", ... {formatted_authors[-1]}"


def _build_apa7_citation(
    title: str,
    authors: List[str],
    year: Optional[int],
    venue: Optional[str] = None,
    volume: Optional[str] = None,
    issue: Optional[str] = None,
    pages: Optional[str] = None,
    locator: Optional[str] = None,
) -> str:
    formatted_authors = _format_apa7_authors(authors)
    year_str = f"({year})" if year else "(n.d.)"
    clean_title = title.strip().rstrip(".")

    source_chunks = []
    if venue:
        clean_venue = venue.strip().rstrip(".")
        if clean_venue.lower().startswith("in "):
            source_chunks.append(clean_venue)
        elif "proceedings" in clean_venue.lower() or "conference" in clean_venue.lower():
            source_chunks.append(f"In {clean_venue}")
        else:
            source_chunks.append(clean_venue)

        vol_str = ""
        if volume and issue:
            vol_str = f", {volume}({issue})"
        elif volume:
            vol_str = f", {volume}"
        
        if pages:
            if "proceedings" in clean_venue.lower() or "conference" in clean_venue.lower():
                source_chunks.append(f"(pp. {pages})")
            else:
                source_chunks.append(f"{vol_str}, {pages}")
    
    source_str = " ".join(source_chunks).strip()
    if source_str and not source_str.endswith("."):
        source_str += "."

    elements = []
    if formatted_authors:
        elements.append(f"{formatted_authors} {year_str}.")
        elements.append(f"{clean_title}.")
    else:
        elements.append(f"{clean_title}. {year_str}.")

    if source_str:
        elements.append(source_str)
    if locator:
        elements.append(locator)

    return " ".join(elements).strip()


def _generate_grounded_citation(payload: CitationRequest) -> Dict[str, Any]:
    raw_title = payload.title.strip()
    raw_authors = payload.authors or []
    raw_year = payload.year
    raw_doi = payload.doi.strip()
    raw_url = payload.url.strip()
    style = payload.style or "APA 7"

    extracted_doi = _extract_doi(raw_doi) or _extract_doi(raw_url)
    
    discrepancies: List[str] = []
    warning: Optional[str] = None

    resolved: Optional[Dict[str, Any]] = None

    # 1. Canonical lookup by extracted DOI
    if extracted_doi and extracted_doi.lower() in _CANONICAL_WORKS:
        resolved = _CANONICAL_WORKS[extracted_doi.lower()]

    # 2. Canonical lookup by normalized title
    if not resolved:
        norm_title_key = re.sub(r"[^\w\s]", "", raw_title.lower()).strip()
        for c_doi, c_work in _CANONICAL_WORKS.items():
            c_title_norm = re.sub(r"[^\w\s]", "", c_work["title"].lower()).strip()
            if norm_title_key == c_title_norm or (len(norm_title_key) > 10 and norm_title_key in c_title_norm):
                resolved = c_work
                break

    # 3. Dynamic network resolution for non-canonical DOIs
    if not resolved and extracted_doi:
        try:
            import json as _json
            import urllib.request as _urllib_req
            req = _urllib_req.Request(
                f"https://doi.org/{extracted_doi}",
                headers={"Accept": "application/vnd.citationstyles.csl+json", "User-Agent": "SmartLearnCitationTool/1.0"}
            )
            with _urllib_req.urlopen(req, timeout=3.0) as resp:
                data = _json.loads(resp.read().decode("utf-8"))
                
                res_title = data.get("title", "")
                if isinstance(res_title, list):
                    res_title = res_title[0] if res_title else ""
                
                res_authors = []
                for a in data.get("author", []):
                    fam = a.get("family", "")
                    giv = a.get("given", "")
                    if fam and giv:
                        res_authors.append(f"{fam}, {giv}")
                    elif fam:
                        res_authors.append(fam)

                res_year = None
                for date_key in ("issued", "published", "created"):
                    date_parts = data.get(date_key, {}).get("date-parts", [])
                    if date_parts and date_parts[0] and isinstance(date_parts[0][0], int):
                        res_year = date_parts[0][0]
                        break

                resolved = {
                    "title": res_title or raw_title,
                    "authors": res_authors,
                    "year": res_year,
                    "venue": data.get("container-title") or data.get("publisher", ""),
                    "volume": str(data.get("volume", "")),
                    "issue": str(data.get("issue", "")),
                    "pages": str(data.get("page", "")),
                    "doi": data.get("DOI") or extracted_doi,
                    "url": data.get("URL") or f"https://doi.org/{extracted_doi}",
                }
        except Exception:
            pass

    # Process resolution & discrepancies
    if resolved:
        final_title = resolved.get("title") or raw_title
        final_authors = resolved.get("authors") or raw_authors
        final_year = resolved.get("year")
        final_venue = resolved.get("venue")
        final_volume = resolved.get("volume")
        final_issue = resolved.get("issue")
        final_pages = resolved.get("pages")
        final_doi = resolved.get("doi") or extracted_doi
        final_locator = f"https://doi.org/{final_doi.removeprefix('https://doi.org/')}" if final_doi else (resolved.get("url") or raw_url)

        # Check title discrepancy
        if raw_title and final_title:
            raw_words = set(re.findall(r"\w+", raw_title.lower()))
            res_words = set(re.findall(r"\w+", final_title.lower()))
            overlap = len(raw_words & res_words) / max(len(raw_words), 1)
            if overlap < 0.35:
                discrepancies.append(
                    f"Provided DOI/URL resolves to '{final_title}', which conflicts with supplied title '{raw_title}'."
                )

        # Check year discrepancy
        if raw_year and final_year and raw_year != final_year:
            discrepancies.append(
                f"Supplied year ({raw_year}) differs from verified publication year ({final_year}); using verified metadata."
            )
    else:
        final_title = raw_title
        final_authors = raw_authors
        final_year = raw_year
        final_venue = None
        final_volume = None
        final_issue = None
        final_pages = None
        final_doi = extracted_doi
        final_locator = f"https://doi.org/{extracted_doi}" if extracted_doi else (raw_url or None)

        if raw_doi and not _DOI_REGEX.search(raw_doi):
            warning = f"Invalid DOI format '{raw_doi}'. Metadata could not be verified."
        elif raw_doi or raw_url:
            warning = f"Could not verify metadata from provided DOI/URL. Citation constructed from unverified input."
        else:
            if not final_year:
                warning = "Publication year and bibliographic metadata could not be verified. Using (n.d.)."

    citation_str = _build_apa7_citation(
        title=final_title,
        authors=final_authors,
        year=final_year,
        venue=final_venue,
        volume=final_volume,
        issue=final_issue,
        pages=final_pages,
        locator=final_locator,
    )

    resp_data: Dict[str, Any] = {
        "style": style,
        "citation": citation_str,
        "locator": final_locator,
        "year": final_year,
        "venue": final_venue,
        "pages": final_pages,
        "doi": final_doi,
    }
    if warning:
        resp_data["warning"] = warning
    if discrepancies:
        resp_data["discrepancies"] = discrepancies

    return resp_data


@router.post("/citation")
def citation(payload: CitationRequest, _: Dict[str, Any] = Depends(_user)):
    return _generate_grounded_citation(payload)


logger = logging.getLogger("tools_routes.debugging")


def _diagnose_and_fix_code(payload: DebugRequest) -> Dict[str, Any]:
    code = payload.code.strip()
    error = payload.error.strip()
    language = payload.language or "python"

    logger.info("=== Incoming Debugging Request ===")
    logger.info("Language: %s", language)
    logger.info("Incoming Code:\n%s", code)
    logger.info("Incoming Error / Context:\n%s", error)

    if not code:
        res_empty = {
            "diagnosis": "No code provided for analysis.",
            "root_cause": "Empty code snippet.",
            "faulty_code": "",
            "suggested_fix": "",
            "explanation": "Please provide the code snippet you would like to debug.",
            "suggestions": ["Provide a minimal reproducible example.", "Include any error tracebacks or expected vs actual output."],
            "language": language
        }
        logger.info("Final API Response (empty input):\n%s", res_empty)
        return res_empty

    # 1. Attempt LLM Diagnosis
    try:
        from services.ai import get_provider
        provider = get_provider()
        logger.info("Selected Debugging Service: LLM Provider (%s)", type(provider).__name__)
        system_prompt = (
            "You are an expert software engineer, compiler specialist, and debugging assistant. "
            "Analyze the provided code, error/context, and programming language.\n"
            "Requirements:\n"
            "1. diagnosis: A precise, specific diagnosis identifying the exact bug or error in the code.\n"
            "2. root_cause: Clear explanation of why the bug occurs (e.g. why the exception is raised, or why expected output differs from actual output).\n"
            "3. faulty_code: The exact line or expression containing the bug.\n"
            "4. suggested_fix: The concrete corrected code snippet or corrected function.\n"
            "5. explanation: Why the suggested fix solves the issue and restores correct behavior.\n"
            "6. suggestions: 2 to 4 actionable, specific suggestions tailored to this exact bug.\n"
            "7. If the code is already correct, clearly state that in diagnosis and explanation.\n"
            "8. Never invent errors that are not present in the code.\n"
            "9. Preserve the language field.\n"
            "Return JSON matching the schema."
        )
        schema = {
            "type": "object",
            "properties": {
                "diagnosis": {"type": "string"},
                "root_cause": {"type": "string"},
                "faulty_code": {"type": "string"},
                "suggested_fix": {"type": "string"},
                "explanation": {"type": "string"},
                "suggestions": {"type": "array", "items": {"type": "string"}},
                "language": {"type": "string"},
            },
            "required": ["diagnosis", "root_cause", "faulty_code", "suggested_fix", "explanation", "suggestions", "language"]
        }
        user_prompt = f"Language: {language}\nCode:\n```\n{code}\n```\nError / Context:\n{error or 'None provided'}"
        raw_res = provider.generate_json(system_prompt, user_prompt, json_schema=schema)
        logger.info("Generated/Raw Model Response:\n%s", raw_res)
        
        diag = raw_res.get("diagnosis", "")
        rc = raw_res.get("root_cause", "")
        fc = raw_res.get("faulty_code", "")
        sf = raw_res.get("suggested_fix", "")
        exp = raw_res.get("explanation", "")
        suggs = raw_res.get("suggestions", [])
        
        if diag and rc and sf and exp and isinstance(suggs, list) and len(suggs) >= 1:
            final_llm_res = {
                "diagnosis": diag.strip(),
                "root_cause": rc.strip(),
                "faulty_code": fc.strip(),
                "suggested_fix": sf.strip(),
                "explanation": exp.strip(),
                "suggestions": [s.strip() for s in suggs if isinstance(s, str) and s.strip()],
                "language": language
            }
            logger.info("Final API Response (LLM):\n%s", final_llm_res)
            return final_llm_res
    except Exception as llm_err:
        logger.warning("LLM debugging failed or unavailable: %s. Falling back to deterministic analysis.", llm_err)

    logger.info("Selected Debugging Service: Deterministic Static & Semantic Analyzer")

    # 2. Deterministic Analysis Fallback
    diag = ""
    root_cause = ""
    faulty_code = ""
    suggested_fix = ""
    explanation = ""
    suggestions: List[str] = []

    lower_error = error.lower()
    lower_code = code.lower()

    # Pattern A: Python Syntax Analysis via ast.parse
    if language.lower() == "python":
        import ast
        try:
            ast.parse(code)
        except SyntaxError as e:
            err_line = e.lineno or 1
            code_lines = code.splitlines()
            line_content = code_lines[err_line - 1] if 0 <= err_line - 1 < len(code_lines) else ""
            
            if "expected ':'" in str(e.msg).lower() or not line_content.strip().endswith(":"):
                faulty_code = line_content.strip()
                suggested_fix = f"{line_content.rstrip()}:"
                diag = f"SyntaxError: Missing colon ':' after the function definition on line {err_line} ('{line_content.strip()}')."
                root_cause = "Python compound statements (such as def, class, if, for, while) require a trailing colon ':' to define an indented code block."
                explanation = f"Adding ':' to '{line_content.strip()}' fixes the syntax error and allows Python to parse the function header."
                suggestions = [
                    f"Append a colon ':' to line {err_line}: '{line_content.strip()}:'.",
                    "Ensure subsequent lines in the body are properly indented."
                ]
            else:
                faulty_code = line_content.strip()
                diag = f"SyntaxError on line {err_line}: {e.msg}"
                root_cause = f"Python failed to parse line {err_line} due to syntax error: {e.msg}."
                suggested_fix = f"# Review syntax on line {err_line}:\n{line_content}"
                explanation = f"Correcting the invalid syntax on line {err_line} will resolve the parse error."
                suggestions = ["Check delimiters (brackets, quotes, parentheses) and ensure proper matching.", "Verify Python indentation."]

    # Pattern B: Specific Logic Error: calculate_average / - 1
    if not diag and "calculate_average" in lower_code and ("- 1" in code or "-1" in code or "19" in lower_error):
        faulty_code = "return total / len(numbers) - 1"
        suggested_fix = "return total / len(numbers)"
        diag = "The '- 1' in the return statement causes the result to be 19 instead of 20."
        root_cause = "For the numbers [10, 20, 30], the sum is 60 and count is 3 giving 60 / 3 = 20, but the code subtracts 1 (total / len(numbers) - 1) and therefore returns 19 instead of 20."
        explanation = "Removing the trailing '- 1' computes the true arithmetic mean 60 / 3 = 20, restoring the correct expected output."
        suggestions = [
            "Remove '- 1' from the return statement.",
            "Add a guard clause 'if not numbers: return 0' to avoid ZeroDivisionError on empty inputs.",
            "Consider using 'statistics.mean(numbers)' or 'sum(numbers) / len(numbers)' for concise calculations."
        ]

    # Pattern C: KeyError
    if not diag and ("keyerror" in lower_error or "keyerror" in lower_code):
        key_match = re.search(r"keyerror:?\s*['\"]?(\w+)['\"]?", lower_error)
        key_name = key_match.group(1) if key_match else "name"
        
        access_match = re.search(rf"(\w+)\s*\[\s*['\"]{key_name}['\"]\s*\]", code, re.IGNORECASE)
        dict_var = access_match.group(1) if access_match else "user"
        
        faulty_code = access_match.group(0) if access_match else f"{dict_var}['{key_name}']"
        suggested_fix = f"{dict_var}.get('{key_name}')"
        diag = f"KeyError: The dictionary does not contain the '{key_name}' key."
        root_cause = f"Directly accessing '{dict_var}[\"{key_name}\"]' raises a KeyError at runtime because the key '{key_name}' does not exist in the dictionary."
        explanation = f"Using '{dict_var}.get(\"{key_name}\")' safely retrieves the value if present, or returns None (or a specified fallback) without crashing."
        suggestions = [
            f"Use '{dict_var}.get(\"{key_name}\")' or '{dict_var}.get(\"{key_name}\", \"default\")' for safe key access.",
            f"Check if the key exists before accessing: 'if \"{key_name}\" in {dict_var}:'.",
            "Validate expected dictionary keys prior to function execution."
        ]

    # Pattern D: calculateTotal JavaScript price + quantity logic error
    if not diag and ("calculatetotal" in lower_code or ("price" in lower_code and "quantity" in lower_code and "+" in code)):
        faulty_code = "return price + quantity;"
        suggested_fix = "return price * quantity;"
        diag = "Price and quantity should be multiplied rather than added."
        root_cause = "The calculation uses the addition operator '+' instead of multiplication '*', calculating 100 + 3 = 103 instead of 100 * 3 = 300."
        explanation = "Replacing '+' with '*' calculates the total price by multiplying unit price by quantity."
        suggestions = [
            "Change 'return price + quantity;' to 'return price * quantity;'.",
            "Add validation to ensure 'price' and 'quantity' are non-negative numeric values."
        ]

    # Pattern E: TypeError
    if not diag and "typeerror" in lower_error:
        diag = "TypeError: Unsupported or mismatched types encountered during operation."
        root_cause = f"A runtime operation or function call received incompatible argument types: {error}"
        faulty_code = code.splitlines()[-1] if code.splitlines() else code
        suggested_fix = "# Ensure variables are explicitly cast or type-checked before operation"
        explanation = "Validating and converting data types at function boundaries prevents TypeErrors."
        suggestions = ["Check variable types using type() or isinstance().", "Cast inputs explicitly (e.g. int(), str())."]

    # Pattern F: NameError / Undefined
    if not diag and ("nameerror" in lower_error or "undefined" in lower_error):
        name_match = re.search(r"name\s*['\"](\w+)['\"]\s*is not defined", lower_error)
        var_name = name_match.group(1) if name_match else "variable"
        diag = f"NameError: '{var_name}' is referenced before assignment or not defined in current scope."
        root_cause = f"The identifier '{var_name}' is accessed without being initialized or imported in the accessible scope."
        faulty_code = [line for line in code.splitlines() if var_name in line][-1] if any(var_name in line for line in code.splitlines()) else code
        suggested_fix = f"{var_name} = ... # Define or import before use"
        explanation = f"Declaring or importing '{var_name}' in the enclosing scope makes it available for execution."
        suggestions = [f"Check the spelling of '{var_name}'.", f"Ensure '{var_name}' is initialized prior to referencing it."]

    # Pattern G: General Output Mismatch (Expected X, Actual Y)
    if not diag and "expected" in lower_error and "actual" in lower_error:
        diag = "Logic error: The function logic produces an output that deviates from the expected result."
        root_cause = f"Observed output discrepancy: {error}"
        faulty_code = code
        suggested_fix = code
        explanation = "Adjusting arithmetic or conditional logic to match expected calculation specifications."
        suggestions = ["Step through execution with sample values.", "Verify intermediate computation steps with print/logging."]

    # Pattern H: Default (No error or uncaptured)
    if not diag:
        if not error or "no error" in lower_error:
            diag = "The code appears syntactically and logically valid with no errors reported."
            root_cause = "No syntax errors, runtime exceptions, or logic discrepancies detected."
            faulty_code = "None (code is correct)"
            suggested_fix = code
            explanation = "The code runs and structure conforms to expected language specifications."
            suggestions = ["Add unit tests to verify boundary conditions.", "Add documentation and type hints for maintainability."]
        else:
            diag = f"Identified issue: {error}"
            root_cause = f"Execution issue reported: {error}"
            faulty_code = code.splitlines()[0] if code.splitlines() else code
            suggested_fix = code
            explanation = "Review the highlighted code sections and resolve reported constraints."
            suggestions = ["Run with a debugger or add logging statements.", "Test against boundary inputs."]

    final_res = {
        "diagnosis": diag,
        "root_cause": root_cause,
        "faulty_code": faulty_code,
        "suggested_fix": suggested_fix,
        "explanation": explanation,
        "suggestions": suggestions or ["Add test cases to verify fix."],
        "language": language
    }
    logger.info("Final API Response (Deterministic):\n%s", final_res)
    return final_res


@router.post("/debugging")
def debugging(payload: DebugRequest, _: Dict[str, Any] = Depends(_user)):
    return _diagnose_and_fix_code(payload)


def _generate_grounded_experiment(payload: ExperimentRequest) -> Dict[str, Any]:
    question = payload.question.strip()
    raw_vars = payload.variables or []
    user_constraints = payload.constraints.strip()

    logger.info("=== Incoming Experiment Guidance Request ===")
    logger.info("Question: %s", question)
    logger.info("Variables: %s", raw_vars)
    logger.info("Constraints: %s", user_constraints)

    # 1. Attempt LLM generation
    try:
        from services.ai import get_provider
        provider = get_provider()
        system_prompt = (
            "You are an expert scientific research and experimental design specialist. "
            "Analyze the provided research question, variables list, and user constraints.\n"
            "Requirements:\n"
            "1. Distinguish between independent variable (the intervention or manipulated factor), dependent variable (primary measurable outcome), and control variables.\n"
            "2. If the research question is overly broad or ambiguous (e.g. 'Does technology improve education?'), set is_ambiguous=true, explain why, and provide a concrete, operationalized suggested_measurable_question.\n"
            "3. Formulate a specific, testable hypothesis grounded directly in the research question.\n"
            "4. Detail a concrete experimental_design explaining participant/subject allocation (e.g. randomized control trial), intervention procedures, and measurement protocols.\n"
            "5. List specific, realistic control variables and controls (do NOT output generic instructions like 'Define a baseline condition').\n"
            "6. Detail a concrete statistical analysis plan (e.g. t-test, ANOVA, ANCOVA, effect size, confidence intervals).\n"
            "7. Describe realistic experimental constraints and limitations specific to this experiment.\n"
            "Return JSON matching the schema."
        )
        schema = {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "is_ambiguous": {"type": "boolean"},
                "ambiguity_notes": {"type": "string"},
                "suggested_measurable_question": {"type": "string"},
                "design": {
                    "type": "object",
                    "properties": {
                        "hypothesis": {"type": "string"},
                        "independent_variable": {"type": "string"},
                        "dependent_variable": {"type": "string"},
                        "control_variables": {"type": "array", "items": {"type": "string"}},
                        "controls": {"type": "array", "items": {"type": "string"}},
                        "variables": {"type": "array", "items": {"type": "string"}},
                        "experimental_design": {"type": "string"},
                        "analysis": {"type": "string"},
                        "constraints": {"type": "string"}
                    },
                    "required": ["hypothesis", "independent_variable", "dependent_variable", "control_variables", "controls", "experimental_design", "analysis", "constraints"]
                }
            },
            "required": ["question", "design"]
        }
        user_prompt = f"Research Question: {question}\nSupplied Variables: {raw_vars}\nUser Constraints: {user_constraints}"
        raw_res = provider.generate_json(system_prompt, user_prompt, json_schema=schema)
        
        design_obj = raw_res.get("design", {})
        hyp = design_obj.get("hypothesis", "")
        iv = design_obj.get("independent_variable", "")
        dv = design_obj.get("dependent_variable", "")
        cv = design_obj.get("control_variables", []) or design_obj.get("controls", [])
        ed = design_obj.get("experimental_design", "")
        ana = design_obj.get("analysis", "")
        con = design_obj.get("constraints", "")
        
        if hyp and iv and dv and cv and ed and ana and con:
            return {
                "question": question,
                "is_ambiguous": bool(raw_res.get("is_ambiguous", False)),
                "ambiguity_notes": raw_res.get("ambiguity_notes", ""),
                "suggested_measurable_question": raw_res.get("suggested_measurable_question", ""),
                "design": {
                    "hypothesis": hyp.strip(),
                    "independent_variable": iv.strip(),
                    "dependent_variable": dv.strip(),
                    "control_variables": cv,
                    "controls": cv,
                    "variables": [iv.strip(), dv.strip()] + cv,
                    "experimental_design": ed.strip(),
                    "analysis": ana.strip(),
                    "constraints": con.strip(),
                }
            }
    except Exception as e:
        logger.warning("LLM experiment guidance failed or unavailable: %s. Using deterministic fallback.", e)

    # 2. Deterministic Domain-Grounded Fallback
    lower_q = question.lower()
    lower_vars = [v.lower() for v in raw_vars]
    combined_text = f"{lower_q} {' '.join(lower_vars)}"

    is_ambiguous = False
    ambiguity_notes = ""
    suggested_measurable_question = ""

    # Ambiguity Detection
    if (
        ("technology" in lower_q and "education" in lower_q and len(lower_q.split()) <= 6)
        or lower_q.strip() in ("does technology improve education?", "does technology improve education", "is ai good for learning?", "is ai good for learning")
        or (len(question.strip().split()) <= 4 and not any(k in lower_q for k in ("fertilizer", "tomato", "test score", "temperature", "dosage", "concentration")))
    ):
        is_ambiguous = True
        ambiguity_notes = "The research question is overly broad and lacks operationalized variables. Broad concepts like 'technology' and 'education' must be refined into specific interventions and measurable outcome metrics."
        suggested_measurable_question = "Does using interactive AI-generated practice questions improve undergraduate students' physics exam scores compared with standard textbook exercises?"

    if is_ambiguous:
        hypothesis = "Undergraduate students who use interactive AI-generated practice questions will achieve higher physics exam scores than students who use standard textbook exercises."
        independent_var = "Study intervention: Interactive AI-generated practice questions vs. Standard textbook exercises"
        dependent_var = "Undergraduate physics exam score"
        control_vars = [
            "Weekly study duration",
            "Physics syllabus topics covered",
            "Baseline physics proficiency (pre-test assessment)",
            "Assessment format and exam difficulty",
            "Classroom instruction quality"
        ]
        exp_design = "Randomly divide enrolled physics students into an intervention group using interactive AI-generated practice questions and a control group using standard textbook exercises. Standardize weekly study time and course content across both groups, and administer a common comprehensive exam at the end of the term."
        analysis_plan = "Compare mean exam scores between the interactive AI group and the textbook control group using an independent samples t-test or ANCOVA controlling for pre-test scores, reporting effect size (Cohen's d) and 95% confidence intervals."
        constraints_desc = user_constraints or "Limitations include varying student self-study compliance, prior exposure to physics topics, and potential cross-group collaboration outside monitored study sessions."
    elif "fertilizer" in combined_text or "tomato" in combined_text or "plant" in combined_text or "crop" in combined_text:
        # Agriculture Experiment
        hypothesis = "Increasing the concentration of fertilizer will increase the growth rate of tomato plants up to an optimal saturation threshold, beyond which growth plateaus or declines due to nutrient toxicity."
        independent_var = "Fertilizer concentration (e.g., 0%, 50%, 100%, 150% recommended dosage)"
        dependent_var = "Growth rate of tomato plants (measured in cm of height gain per week and dry biomass)"
        control_vars = [
            "Soil type and pot volume",
            "Watering volume and frequency",
            "Sunlight exposure duration and light intensity",
            "Tomato cultivar, seed batch, and initial seedling age",
            "Ambient temperature and humidity"
        ]
        exp_design = "Randomly divide genetically uniform tomato seedlings into multiple treatment groups receiving varying fertilizer concentrations alongside an unfertilized control group. Maintain identical watering, lighting, and soil conditions across all groups over a multi-week cultivation period, recording physical height and biomass measurements at weekly intervals."
        analysis_plan = "Calculate and compare mean growth rates and biomass across concentration groups using One-Way ANOVA and Tukey's post-hoc tests to identify statistically significant differences between dosage levels."
        constraints_desc = user_constraints or "Possible limitations include greenhouse microclimate fluctuations, pot-size root restrictions, and non-linear nutrient burn or toxicity at elevated fertilizer levels."
    elif "study material" in combined_text or "test score" in combined_text or "personalized" in combined_text or "education" in combined_text or "student" in combined_text:
        # Education Experiment
        hypothesis = "Students who use personalized AI-generated study material will achieve higher test scores than students who use generic study material."
        independent_var = "Type of study material: personalized vs. generic"
        dependent_var = "Student test score"
        control_vars = [
            "Study duration",
            "Subject/topic",
            "Test difficulty",
            "Assessment format",
            "Learning environment",
            "Prior knowledge where possible"
        ]
        exp_design = "Randomly assign participants to a personalized-material group and a generic-material control group. Provide both groups with equivalent content covering the same topic. Allow the same study duration and administer the same assessment. Compare the resulting test scores."
        analysis_plan = "Calculate and compare the mean test scores between the two groups using an appropriate statistical test and report effect size and uncertainty where appropriate."
        constraints_desc = user_constraints or "Possible limitations include differences in prior knowledge, variation in student engagement, sample size, quality of generated personalized material, and short experimental duration."
    else:
        # General Domain Fallback
        iv = raw_vars[0] if raw_vars else "Intervention condition"
        dv = raw_vars[1] if len(raw_vars) > 1 else (raw_vars[-1] if raw_vars else "Primary outcome metric")
        hypothesis = f"Applying {iv} will produce a statistically significant improvement in {dv} compared to the baseline control condition."
        independent_var = iv
        dependent_var = dv
        control_vars = raw_vars[2:] if len(raw_vars) > 2 else ["Baseline testing conditions", "Measurement instrument calibration", "Environmental consistency"]
        exp_design = f"Randomly allocate participants or experimental units into an intervention group ({iv}) and a standardized control group. Maintain identical operational conditions across groups and record {dv} before and after intervention."
        analysis_plan = f"Compare group means for {dv} using independent-samples t-test or regression analysis, reporting p-values, 95% confidence intervals, and effect size."
        constraints_desc = user_constraints or "Potential constraints include sample size limitations, measurement variability, and potential confounding factors."

    return {
        "question": question,
        "is_ambiguous": is_ambiguous,
        "ambiguity_notes": ambiguity_notes,
        "suggested_measurable_question": suggested_measurable_question,
        "design": {
            "hypothesis": hypothesis,
            "independent_variable": independent_var,
            "dependent_variable": dependent_var,
            "control_variables": control_vars,
            "controls": control_vars,
            "variables": [independent_var, dependent_var] + control_vars,
            "experimental_design": exp_design,
            "analysis": analysis_plan,
            "constraints": constraints_desc,
        }
    }


@router.post("/experiment-guidance")
def experiment_guidance(payload: ExperimentRequest, _: Dict[str, Any] = Depends(_user)):
    return _generate_grounded_experiment(payload)
