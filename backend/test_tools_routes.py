import pytest
from main import app, get_current_user


def _user():
    return {"id": "local-user", "email": "student@example.com", "name": "Local Student", "role": "student"}


def test_academic_tools_are_protected_and_deterministic(client):
    response = client.post("/api/tools/coding-assessment", json={"code": "print('ok')", "tests": "assert True"})
    assert response.status_code == 401

    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/coding-assessment", json={"code": "print('ok')", "tests": "assert True"})
    assert response.status_code == 200
    assert response.json()["score"] >= 50


def test_research_and_wellness_tools_return_safe_local_results(client):
    app.dependency_overrides[get_current_user] = _user
    review = client.post("/api/tools/literature-review", json={"text": "A useful finding. A limitation remains."})
    assert review.status_code == 200
    assert review.json()["evidence_sentences"]

    wellness = client.post("/api/tools/wellness-support", json={"message": "I feel overwhelmed"})
    assert wellness.status_code == 200
    assert wellness.json()["is_crisis_signal"] is False
    assert "not a clinician" in wellness.json()["disclaimer"]


# 1. Explicit suicidal ideation
@pytest.mark.parametrize(
    "message",
    [
        "I feel completely hopeless and I don't want to be alive anymore.",
        "I want to kill myself.",
        "I am going to end my life.",
        "I want to commit suicide.",
        "I decided to take my own life.",
        "I wish I was dead.",
    ],
)
def test_wellness_detects_explicit_suicidal_ideation(client, message):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/wellness-support", json={"message": message})
    assert response.status_code == 200
    body = response.json()
    assert body["is_crisis_signal"] is True
    assert "trusted person" in body["supportive_message"]
    assert "Reduce the task" not in body["supportive_message"]
    assert "Take a short pause" not in body["supportive_message"]


# 2. Self-harm intent
@pytest.mark.parametrize(
    "message",
    [
        "I am thinking about hurting myself.",
        "I want to hurt myself.",
        "I may hurt myself tonight.",
        "I am going to harm myself.",
        "I feel like cutting myself.",
    ],
)
def test_wellness_detects_self_harm_intent(client, message):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/wellness-support", json={"message": message})
    assert response.status_code == 200
    body = response.json()
    assert body["is_crisis_signal"] is True
    assert "trusted person" in body["supportive_message"]
    assert "emergency" in body["supportive_message"].lower() or "crisis" in body["supportive_message"].lower()


# 3. Indirect high-risk language
@pytest.mark.parametrize(
    "message",
    [
        "Everyone would be better off without me.",
        "I don't see a reason to continue living.",
        "There is no point in living anymore.",
        "I am better off dead.",
        "I am tired of living.",
        "I am done with life.",
    ],
)
def test_wellness_detects_indirect_high_risk_language(client, message):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/wellness-support", json={"message": message})
    assert response.status_code == 200
    body = response.json()
    assert body["is_crisis_signal"] is True
    assert "trusted person" in body["supportive_message"]


# 4. Normal stress, sadness, loneliness, and false positive guards
@pytest.mark.parametrize(
    "message",
    [
        "I'm stressed about my exams.",
        "I am feeling stressed and overwhelmed with deadlines.",
        "I failed my exam and feel terrible.",
        "I feel so sad today.",
        "I am feeling really down and sad about my grades.",
        "I'm lonely today.",
        "I feel lonely in my new dormitory.",
        "I don't want to be late for class.",
        "This assignment is killing me with work.",
        "I am dying of curiosity.",
    ],
)
def test_wellness_does_not_flag_normal_distress_or_false_positives(client, message):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/wellness-support", json={"message": message})
    assert response.status_code == 200
    body = response.json()
    assert body["is_crisis_signal"] is False
    assert "not a clinician" in body["disclaimer"]


# 5. Empty input validation
def test_wellness_rejects_empty_input(client):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/wellness-support", json={"message": ""})
    assert response.status_code == 422


# 6. Research Gaps Tool - Grounded Analysis & Domain Keywords
SOURCE_TEXT_AI_HIGHER_ED = """Generative AI has increasingly been used in higher education to support teaching, learning, assessment, and research. Large language models such as ChatGPT can generate explanations, summarize academic material, answer student questions, and create practice questions. Several studies report that AI-based tutoring can provide immediate feedback and support personalized learning. However, the quality of generated responses can vary depending on the prompt, subject, and model used.

Existing research has mainly focused on the usefulness and accuracy of generative AI for individual learning tasks. Many studies use small samples of students from a single institution or evaluate AI systems over a short period. There is limited evidence about the long-term impact of AI tutoring on student learning outcomes, critical thinking, and independent problem-solving skills.

Another limitation is that many educational AI systems are designed primarily for English-language content. Less research has investigated multilingual AI tutoring for students who study in regional or non-English languages. In addition, existing studies often evaluate the technical performance of AI systems but provide limited analysis of privacy, bias, hallucinations, and explainability.

Personalized learning is another area requiring further investigation. Although AI systems can recommend learning materials based on student interactions, there is limited research comparing different personalization strategies and determining which approaches produce measurable improvements in academic performance.

Future research should therefore investigate long-term and large-scale deployments of generative AI in higher education. Studies should include students from different institutions, disciplines, and language backgrounds. More research is also needed on explainable AI, privacy-preserving approaches, bias detection, hallucination reduction, and the effect of AI-assisted learning on critical thinking and independent learning."""


def test_research_gaps_grounded_in_source_text(client):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/research-gaps", json={"text": SOURCE_TEXT_AI_HIGHER_ED})
    assert response.status_code == 200
    data = response.json()

    assert "gaps" in data
    assert "keywords" in data

    gaps = data["gaps"]
    keywords = data["keywords"]

    # 4 to 8 specific gaps
    assert 4 <= len(gaps) <= 8

    # No generic filler when unsupported
    assert not any("comparison baseline" in g.lower() for g in gaps)
    assert not any("external validation" in g.lower() for g in gaps)

    combined_gaps = " ".join(gaps).lower()

    # Substantially related to expected areas
    assert any(term in combined_gaps for term in ("long-term", "longitudinal", "short-term"))
    assert any(term in combined_gaps for term in ("small sample", "single institution", "multi-institutional", "institutions"))
    assert any(term in combined_gaps for term in ("multilingual", "regional", "non-english", "english-language"))
    assert any(term in combined_gaps for term in ("privacy", "bias", "hallucination", "explainab"))
    assert any(term in combined_gaps for term in ("critical thinking", "independent problem-solving", "independent learning"))
    assert any(term in combined_gaps for term in ("personalization", "personalized", "comparing different"))

    # Each gap explains what research did, what is missing, and why it matters
    for gap in gaps:
        assert len(gap.split()) >= 12
        assert any(term in gap.lower() for term in ("existing", "current", "studies", "research", "focus", "report", "primarily", "often", "mainly", "literature", "while", "although"))
        assert any(term in gap.lower() for term in ("missing", "limited", "limit", "lack", "need", "further", "investigation", "gap", "unaddressed", "few", "less", "absent", "insufficient", "unclear", "unexplored", "under-researched", "scant", "inadequate", "little", "scarcity", "shortage", "without"))
        assert any(term in gap.lower() for term in ("matter", "critical", "vital", "essential", "important", "necessary", "ensure", "guarantee", "impact", "risk", "standard", "significant", "crucial", "benefit", "consequence", "leads to", "undermine", "imped", "affect", "implication", "prevent", "vital", "key"))

    # Stopwords strictly excluded
    forbidden_stopwords = {"the", "and", "is", "are", "can", "of", "to", "in", "for", "a", "an", "such", "using"}
    for kw in keywords:
        assert kw.lower() not in forbidden_stopwords
        assert not all(part.lower() in forbidden_stopwords for part in kw.split())

    # Meaningful domain keywords present
    combined_keywords = " ".join(keywords).lower()
    assert any(term in combined_keywords for term in ("generative ai", "higher education", "ai tutoring", "personalized learning", "critical thinking", "privacy", "bias", "hallucinations", "explainability", "multilingual"))


# 7. Proposal Writer Tool - Grounded Academic Proposal Generation
PROPOSAL_PAYLOAD_AI_LEARNING = {
    "title": "Generative AI-Based Personalized Learning Assistant for Higher Education",
    "context": SOURCE_TEXT_AI_HIGHER_ED,
    "objectives": [
        "develop a generative ai-based personalized learning assistant for higher education students",
        "integrate multilingual tutoring capabilities for diverse student cohorts",
        "evaluate learning gains, critical thinking, and usability compared with generic AI assistance",
        "implement privacy-preserving data handling and bias/hallucination mitigation techniques"
    ]
}

PROPOSAL_PAYLOAD_WATER_IOT = {
    "title": "IoT-Based Smart Water Quality Monitoring and Filtration System for Rural Communities",
    "context": "Access to clean drinking water remains a critical challenge in rural areas due to agricultural runoff, heavy metal contamination, and lack of real-time monitoring infrastructure. Existing testing methods are manual, infrequent, and costly, delaying necessary interventions. This project proposes an automated IoT-enabled sensor network combined with solar-powered multi-stage filtration to provide continuous water quality assessment and decentralized purification.",
    "objectives": [
        "Deploy low-cost IoT sensor nodes for real-time pH, turbidity, and contaminant monitoring",
        "Develop an automated alert and filtration control system",
        "Evaluate filtration efficiency and sensor reliability under field conditions"
    ]
}


def test_proposal_writer_ai_personalized_learning(client):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/proposal", json=PROPOSAL_PAYLOAD_AI_LEARNING)
    assert response.status_code == 200
    data = response.json()

    assert "title" in data
    assert "sections" in data
    assert data["title"] == PROPOSAL_PAYLOAD_AI_LEARNING["title"]

    sections = data["sections"]
    assert "background" in sections
    assert "objectives" in sections
    assert "method" in sections
    assert "ethics" in sections
    assert "expected_outcomes" in sections

    background = sections["background"]
    objectives = sections["objectives"]
    method = sections["method"]
    ethics = sections["ethics"]
    expected_outcomes = sections["expected_outcomes"]

    # 1. No generic placeholder instructions
    forbidden_placeholders = [
        "Define participants or data sources, procedure, measures, and an analysis plan.",
        "State measurable outcomes and how negative or mixed results will be reported.",
        "Minimize data collection, obtain consent where needed, and protect identities.",
        "Describe the problem, its stakeholders, and why it matters.",
    ]
    for ph in forbidden_placeholders:
        assert ph.lower() not in method.lower()
        assert ph.lower() not in expected_outcomes.lower()
        assert ph.lower() not in ethics.lower()

    # 2. Background transforms context and preserves meaning
    assert len(background.split()) >= 20
    assert any(w in background.lower() for w in ("generative ai", "higher education", "tutoring", "learning", "challenges", "research"))

    # 3. Objectives are normalized
    assert len(objectives) >= 3
    for obj in objectives:
        assert obj[0].isupper()

    # 4. Method contains actual grounded methodology
    method_lower = method.lower()
    assert any(term in method_lower for term in ("student population", "target", "requirements", "cohort"))
    assert any(term in method_lower for term in ("architecture", "design", "pipeline"))
    assert any(term in method_lower for term in ("consent", "preferences", "interaction"))
    assert any(term in method_lower for term in ("explanations", "study materials", "practice questions", "recommendations", "content generation"))
    assert any(term in method_lower for term in ("personalization", "proficiency", "adaptive", "language"))
    assert any(term in method_lower for term in ("explainability", "privacy", "hallucination", "bias", "verification"))
    assert any(term in method_lower for term in ("accuracy", "relevance", "usability", "learning-outcome", "evaluation"))
    assert any(term in method_lower for term in ("compare", "comparison", "generic ai", "baseline"))
    assert any(term in method_lower for term in ("analyze", "analysis", "quantitative", "qualitative", "statistical"))

    # 5. Expected outcomes contains actual project outcomes
    outcomes_lower = expected_outcomes.lower()
    assert any(term in outcomes_lower for term in ("working", "assistant", "system", "prototype"))
    assert any(term in outcomes_lower for term in ("explanations", "study materials", "practice questions", "recommendations"))
    assert any(term in outcomes_lower for term in ("multilingual", "language"))
    assert any(term in outcomes_lower for term in ("accuracy", "relevance", "usability", "reliability"))
    assert any(term in outcomes_lower for term in ("learning outcomes", "academic performance", "generic ai", "improvement"))
    assert any(term in outcomes_lower for term in ("hallucinations", "bias", "privacy", "explainability", "limitations"))

    # 6. Ethics specifically addresses governance
    ethics_lower = ethics.lower()
    assert any(term in ethics_lower for term in ("informed consent", "consent"))
    assert any(term in ethics_lower for term in ("data minimization", "minimizing collection", "minimal"))
    assert any(term in ethics_lower for term in ("privacy", "encrypt", "secure storage"))
    assert any(term in ethics_lower for term in ("anonymiz", "pseudonymiz"))
    assert any(term in ethics_lower for term in ("transparency", "ai-generated", "disclos"))
    assert any(term in ethics_lower for term in ("bias", "harmful"))
    assert any(term in ethics_lower for term in ("delete", "control", "rights", "withdraw", "export"))


def test_proposal_writer_unrelated_project_changes_dynamically(client):
    app.dependency_overrides[get_current_user] = _user
    response = client.post("/api/tools/proposal", json=PROPOSAL_PAYLOAD_WATER_IOT)
    assert response.status_code == 200
    data = response.json()

    assert data["title"] == PROPOSAL_PAYLOAD_WATER_IOT["title"]
    sections = data["sections"]

    background = sections["background"].lower()
    method = sections["method"].lower()
    expected_outcomes = sections["expected_outcomes"].lower()
    ethics = sections["ethics"].lower()

    # Grounded in water / IoT domain
    assert any(w in background for w in ("water", "filtration", "contamination", "rural", "iot"))
    assert any(w in method for w in ("sensor", "filtration", "telemetry", "monitoring", "alert", "field"))
    assert any(w in expected_outcomes for w in ("iot", "filtration", "telemetry", "prototype", "water"))
    assert any(w in ethics for w in ("community", "environmental", "water", "stakeholder", "privacy", "public health"))

    # Does NOT contain AI tutoring text from other project
    assert "multilingual ai tutoring" not in method
    assert "hallucination reduction" not in method


# 8. Citation Generator Tool Tests
def test_citation_bert_paper_verified_metadata(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin, J.", "Chang, M.-W.", "Lee, K.", "Toutanova, K."],
        "doi": "https://doi.org/10.48550/arXiv.1810.04805"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["year"] == 2019
    assert "2026" not in data["citation"]

    # Expected authors with & before final author in APA 7
    assert "Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K." in data["citation"]
    assert "(2019)" in data["citation"]

    # Published conference venue & page range & ACL DOI
    assert "NAACL" in data["citation"]
    assert any(p in data["citation"] for p in ("4171–4186", "4171-4186"))
    assert "10.18653/v1/N19-1423" in data["citation"]


def test_citation_correct_publication_year_never_defaults_to_current_year(client):
    app.dependency_overrides[get_current_user] = _user
    # When year is omitted, never default to 2026
    payload = {
        "title": "Deep Residual Learning for Image Recognition",
        "authors": ["He, K.", "Zhang, X.", "Ren, S.", "Sun, J."],
        "doi": "10.1109/CVPR.2016.90"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2016
    assert "2026" not in data["citation"]
    assert "(2016)" in data["citation"]


def test_citation_multiple_authors_apa7_ampersand(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "Attention Is All You Need",
        "authors": ["Vaswani, A.", "Shazeer, N.", "Parmar, N.", "Uszkoreit, J.", "Jones, L.", "Gomez, A. N.", "Kaiser, Ł.", "Polosukhin, I."],
        "doi": "https://doi.org/10.48550/arXiv.1706.03762"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "& Polosukhin, I." in data["citation"]
    assert "(2017)" in data["citation"]


def test_citation_missing_author(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "A Generic Technical Manual for Distributed Systems",
        "authors": [],
        "year": 2021
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    # In APA 7, missing author causes title to move to front
    assert data["citation"].startswith("A Generic Technical Manual for Distributed Systems. (2021)")


def test_citation_invalid_doi(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "An Unindexed Student Project Report",
        "authors": ["Smith, J."],
        "doi": "invalid-doi-format"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "warning" in data
    assert "Invalid DOI format" in data["warning"]
    assert "Smith, J. (n.d.). An Unindexed Student Project Report." in data["citation"]


def test_citation_doi_resolving_to_different_publication(client):
    app.dependency_overrides[get_current_user] = _user
    # User provides title for BERT, but provides DOI for ResNet
    payload = {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin, J."],
        "doi": "10.1109/CVPR.2016.90"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "discrepancies" in data
    assert any("conflicts with supplied title" in d for d in data["discrepancies"])


def test_citation_missing_metadata(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "Unknown Field Notes from Fieldwork",
        "authors": []
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "(n.d.)" in data["citation"]
    assert "warning" in data


def test_citation_url_instead_of_doi(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin, J.", "Chang, M.-W.", "Lee, K.", "Toutanova, K."],
        "url": "https://arxiv.org/abs/1810.04805"
    }
    response = client.post("/api/tools/citation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2019
    assert "(2019)" in data["citation"]
    assert "NAACL" in data["citation"]


# 9. Debugging Assistant Tests
def test_debugging_case1_calculate_average_logic_error(client):
    app.dependency_overrides[get_current_user] = _user
    code = """def calculate_average(numbers):
    total = 0

    for number in numbers:
        total += number

    return total / len(numbers) - 1

numbers = [10, 20, 30]
print(calculate_average(numbers))"""

    payload = {
        "code": code,
        "error": "The program runs without a syntax error, but the output is incorrect.\nExpected output: 20\nActual output: 19",
        "language": "python"
    }
    response = client.post("/api/tools/debugging", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["language"] == "python"
    assert "diagnosis" in data
    assert "root_cause" in data
    assert "faulty_code" in data
    assert "suggested_fix" in data
    assert "explanation" in data
    assert "suggestions" in data

    combined_analysis = (data["diagnosis"] + " " + data["root_cause"] + " " + data["faulty_code"]).lower()
    assert any(term in combined_analysis for term in ("- 1", "-1", "subtraction", "19", "subtract"))
    assert any(term in data["suggested_fix"] for term in ("total / len(numbers)", "sum(numbers)"))


def test_debugging_case2_keyerror_name(client):
    app.dependency_overrides[get_current_user] = _user
    code = """def get_user_name(user):
    return user["name"]

user = {"email": "student@example.com"}
print(get_user_name(user))"""

    payload = {
        "code": code,
        "error": "KeyError: 'name'",
        "language": "python"
    }
    response = client.post("/api/tools/debugging", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["language"] == "python"
    combined_analysis = (data["diagnosis"] + " " + data["root_cause"]).lower()
    assert any(term in combined_analysis for term in ("name", "keyerror", "dictionary", "key"))
    assert any(term in data["suggested_fix"].lower() for term in ("get", "in user", "user["))


def test_debugging_case3_syntax_error_missing_colon(client):
    app.dependency_overrides[get_current_user] = _user
    code = """def greet(name)
    print("Hello", name)"""

    payload = {
        "code": code,
        "error": "SyntaxError: expected ':'",
        "language": "python"
    }
    response = client.post("/api/tools/debugging", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["language"] == "python"
    combined_analysis = (data["diagnosis"] + " " + data["root_cause"]).lower()
    assert any(term in combined_analysis for term in (":", "colon", "syntaxerror", "syntax"))
    assert ":" in data["suggested_fix"]


def test_debugging_case4_javascript_operator_error(client):
    app.dependency_overrides[get_current_user] = _user
    code = """function calculateTotal(price, quantity) {
    return price + quantity;
}

console.log(calculateTotal(100, 3));"""

    payload = {
        "code": code,
        "error": "Expected output: 300\nActual output: 103",
        "language": "javascript"
    }
    response = client.post("/api/tools/debugging", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["language"] == "javascript"
    combined_analysis = (data["diagnosis"] + " " + data["root_cause"]).lower()
    assert any(term in combined_analysis for term in ("multipl", "*", "added", "addition", "+", "operator"))
    assert "*" in data["suggested_fix"]


def test_debugging_correct_code_no_error(client):
    app.dependency_overrides[get_current_user] = _user
    code = """def add(a, b):
    return a + b"""

    payload = {
        "code": code,
        "error": "",
        "language": "python"
    }
    response = client.post("/api/tools/debugging", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["language"] == "python"
    assert any(term in data["diagnosis"].lower() for term in ("valid", "correct", "sound", "no error", "passed"))


# 10. Experiment Guidance Tests
def test_experiment_guidance_education_personalized_ai(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "question": "Does personalized AI-generated study material improve students' test scores compared with generic study material?",
        "variables": [
            "personalized study material",
            "generic study material",
            "student test score",
            "study time"
        ]
    }
    response = client.post("/api/tools/experiment-guidance", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "question" in data
    assert "design" in data
    design = data["design"]

    # 1. Hypothesis focuses on test scores outcome vs study material
    hyp_lower = design["hypothesis"].lower()
    assert "test score" in hyp_lower or "scores" in hyp_lower
    assert any(w in hyp_lower for w in ("personalized", "generic", "higher", "improv"))

    # 2. Distinguishes independent, dependent, and controls
    iv_lower = design["independent_variable"].lower()
    assert "personalized" in iv_lower or "study material" in iv_lower or "type of" in iv_lower

    dv_lower = design["dependent_variable"].lower()
    assert "test score" in dv_lower or "score" in dv_lower

    controls = [c.lower() for c in design.get("control_variables", []) or design.get("controls", [])]
    assert any("study duration" in c or "study time" in c or "duration" in c for c in controls)
    assert any("subject" in c or "topic" in c or "difficulty" in c for c in controls)

    # 3. Experimental design explains randomization & testing
    ed_lower = design["experimental_design"].lower()
    assert any(w in ed_lower for w in ("random", "group", "assign", "control group"))

    # 4. Statistical analysis
    ana_lower = design["analysis"].lower()
    assert any(w in ana_lower for w in ("mean", "compare", "statistical", "t-test", "effect size"))

    # 5. Constraints
    con_lower = design["constraints"].lower()
    assert any(w in con_lower for w in ("prior knowledge", "engagement", "sample size", "limitations", "duration"))


def test_experiment_guidance_agriculture_fertilizer(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "question": "Does increasing the concentration of fertilizer affect the growth rate of tomato plants?"
    }
    response = client.post("/api/tools/experiment-guidance", json=payload)
    assert response.status_code == 200
    data = response.json()

    design = data["design"]
    iv_lower = design["independent_variable"].lower()
    assert "fertilizer" in iv_lower or "concentration" in iv_lower

    dv_lower = design["dependent_variable"].lower()
    assert "growth rate" in dv_lower or "height" in dv_lower or "biomass" in dv_lower

    hyp_lower = design["hypothesis"].lower()
    assert "fertilizer" in hyp_lower and ("growth" in hyp_lower or "tomato" in hyp_lower)

    controls = [c.lower() for c in design.get("control_variables", []) or design.get("controls", [])]
    assert any("soil" in c or "water" in c or "sunlight" in c or "light" in c for c in controls)


def test_experiment_guidance_ambiguous_question_identified(client):
    app.dependency_overrides[get_current_user] = _user
    payload = {
        "question": "Does technology improve education?"
    }
    response = client.post("/api/tools/experiment-guidance", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Identifies that the question is ambiguous / broad and offers measurable version
    assert data.get("is_ambiguous") is True or "broad" in data.get("ambiguity_notes", "").lower()
    assert len(data.get("suggested_measurable_question", "")) > 15





