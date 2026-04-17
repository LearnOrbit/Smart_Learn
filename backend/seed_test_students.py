"""
Seed script: creates 3 dummy student accounts and sample scored data
so the Scores Dashboard has visible content for testing.

Run:  python seed_test_students.py
      (from the backend/ directory with venv activated)

Idempotent — skips records that already exist.
"""

import uuid
from database import SessionLocal, User, Subject, ProgramOutcome, CourseOutcome, LearningOutcome
from database import Assignment, AssignmentLOMapping, Submission, StudentPerformance
from auth import hash_password

db = SessionLocal()

# ── 1. Ensure a teacher exists (reuse existing or create) ──────────
teacher = db.query(User).filter(User.email == "teacher@academiq.com").first()
if not teacher:
    teacher = User(
        id=str(uuid.uuid4()),
        email="teacher@academiq.com",
        name="Prof. Demo",
        password_hash=hash_password("teacher123"),
        role="teacher",
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    print(f"✅ Created teacher: teacher@academiq.com / teacher123")
else:
    print(f"ℹ  Teacher already exists: {teacher.email}")

TEACHER_ID = teacher.id

# ── 2. Three dummy students ────────────────────────────────────────
STUDENTS = [
    {"email": "alice.student@academiq.com",
        "name": "Alice Johnson",   "password": "student123"},
    {"email": "bob.student@academiq.com",
        "name": "Bob Williams",    "password": "student123"},
    {"email": "carol.student@academiq.com",
        "name": "Carol Martinez",  "password": "student123"},
]

student_ids = []
for s in STUDENTS:
    existing = db.query(User).filter(User.email == s["email"]).first()
    if existing:
        student_ids.append(existing.id)
        print(f"ℹ  Student already exists: {s['email']}")
    else:
        u = User(
            id=str(uuid.uuid4()),
            email=s["email"],
            name=s["name"],
            password_hash=hash_password(s["password"]),
            role="student",
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        student_ids.append(u.id)
        print(f"✅ Created student: {s['email']} / {s['password']}")

# ── 3. Subject ─────────────────────────────────────────────────────
subject = db.query(Subject).filter(Subject.code == "CS101").first()
if not subject:
    subject = Subject(
        id=str(uuid.uuid4()),
        code="CS101",
        name="Introduction to Computer Science",
        description="Foundational CS concepts",
        created_by=TEACHER_ID,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    print("✅ Created subject CS101")
else:
    print("ℹ  Subject CS101 already exists")

# ── 4. Outcome hierarchy: PO → CO → LO ────────────────────────────


def get_or_create_po(code, desc):
    po = db.query(ProgramOutcome).filter(ProgramOutcome.code ==
                                         code, ProgramOutcome.subject_id == subject.id).first()
    if not po:
        po = ProgramOutcome(id=str(uuid.uuid4()), code=code, description=desc,
                            subject_id=subject.id, created_by=TEACHER_ID)
        db.add(po)
        db.commit()
        db.refresh(po)
        print(f"  ✅ PO {code}")
    return po


def get_or_create_co(code, desc, po):
    co = db.query(CourseOutcome).filter(CourseOutcome.code ==
                                        code, CourseOutcome.subject_id == subject.id).first()
    if not co:
        co = CourseOutcome(id=str(uuid.uuid4()), code=code, description=desc,
                           program_outcome_id=po.id, subject_id=subject.id, created_by=TEACHER_ID)
        db.add(co)
        db.commit()
        db.refresh(co)
        print(f"  ✅ CO {code}")
    return co


def get_or_create_lo(code, desc, co):
    lo = db.query(LearningOutcome).filter(LearningOutcome.code ==
                                          code, LearningOutcome.subject_id == subject.id).first()
    if not lo:
        lo = LearningOutcome(id=str(uuid.uuid4()), code=code, description=desc,
                             course_outcome_id=co.id, subject_id=subject.id, created_by=TEACHER_ID)
        db.add(lo)
        db.commit()
        db.refresh(lo)
        print(f"  ✅ LO {code}")
    return lo


print("\nSeeding outcomes...")
po1 = get_or_create_po("PO1", "Apply computational thinking to solve problems")
po2 = get_or_create_po("PO2", "Design algorithms for real-world scenarios")

co1 = get_or_create_co(
    "CO1", "Understand data structures and their operations", po1)
co2 = get_or_create_co(
    "CO2", "Implement sorting and searching algorithms", po1)
co3 = get_or_create_co("CO3", "Analyze algorithm complexity", po2)

lo1 = get_or_create_lo("LO1", "Implement linked lists and stacks", co1)
lo2 = get_or_create_lo("LO2", "Implement queues and trees", co1)
lo3 = get_or_create_lo("LO3", "Apply quicksort and mergesort", co2)
lo4 = get_or_create_lo("LO4", "Implement binary search", co2)
lo5 = get_or_create_lo("LO5", "Calculate Big-O notation", co3)

# ── 5. Assignments linked to LOs ──────────────────────────────────


def get_or_create_assignment(title, desc, lo_list):
    a = db.query(Assignment).filter(Assignment.title == title,
                                    Assignment.teacher_id == TEACHER_ID).first()
    if not a:
        a = Assignment(id=str(uuid.uuid4()), teacher_id=TEACHER_ID,
                       title=title, description=desc)
        db.add(a)
        db.commit()
        db.refresh(a)
        print(f"  ✅ Assignment: {title}")
        for lo in lo_list:
            mapping = AssignmentLOMapping(
                id=str(uuid.uuid4()), assignment_id=a.id, learning_outcome_id=lo.id)
            db.add(mapping)
        db.commit()
    return a


print("\nSeeding assignments...")
a1 = get_or_create_assignment(
    "Lab 1: Linked Lists", "Implement singly and doubly linked lists", [lo1])
a2 = get_or_create_assignment(
    "Lab 2: Trees & Queues", "BST insertion and BFS traversal", [lo2])
a3 = get_or_create_assignment(
    "Lab 3: Sorting Algorithms", "Implement quicksort and mergesort", [lo3])
a4 = get_or_create_assignment(
    "Quiz: Binary Search", "Timed quiz on binary search variants", [lo4])
a5 = get_or_create_assignment(
    "Homework: Complexity Analysis", "Big-O problems", [lo5])

# ── 6. Graded submissions for each student ─────────────────────────
# Marks out of 100 — varied so each student has different scores
MARKS = {
    # student_index: { assignment: marks }
    0: {a1: 85, a2: 78, a3: 92, a4: 70, a5: 65},   # Alice — strong
    1: {a1: 55, a2: 60, a3: 48, a4: 42, a5: 38},   # Bob — moderate/weak
    2: {a1: 72, a2: 80, a3: 68, a4: 75, a5: 90},   # Carol — mixed strong
}

print("\nSeeding graded submissions...")
for idx, sid in enumerate(student_ids):
    for assignment, marks in MARKS[idx].items():
        existing = db.query(Submission).filter(
            Submission.assignment_id == assignment.id,
            Submission.student_id == sid
        ).first()
        if existing:
            # Update marks if changed
            if existing.marks != marks:
                existing.marks = marks
                db.commit()
            continue
        sub = Submission(
            id=str(uuid.uuid4()),
            assignment_id=assignment.id,
            student_id=sid,
            content=f"Submission by student for {assignment.title}",
            marks=marks,
            grade="A" if marks >= 80 else "B" if marks >= 60 else "C" if marks >= 40 else "F",
            feedback="Auto-seeded for testing",
        )
        db.add(sub)
    db.commit()
    print(f"  ✅ Submissions for {STUDENTS[idx]['name']}")

# ── 7. Student performance metrics ────────────────────────────────
PERF = [
    {"student_marks": 82, "attendance": 90, "internal_assessments": 85, "lab_performance": 88,
     "assignment_scores": 78, "study_hours": 6, "concept_mastery": 80},
    {"student_marks": 55, "attendance": 70, "internal_assessments": 50, "lab_performance": 58,
     "assignment_scores": 49, "study_hours": 3, "concept_mastery": 45},
    {"student_marks": 75, "attendance": 85, "internal_assessments": 78, "lab_performance": 80,
     "assignment_scores": 77, "study_hours": 5, "concept_mastery": 72},
]

print("\nSeeding performance metrics...")
for idx, sid in enumerate(student_ids):
    existing = db.query(StudentPerformance).filter(
        StudentPerformance.student_id == sid).first()
    if existing:
        print(f"  ℹ  Performance already exists for {STUDENTS[idx]['name']}")
        continue
    perf = StudentPerformance(
        id=str(uuid.uuid4()),
        student_id=sid,
        subject_id=subject.id,
        updated_by=TEACHER_ID,
        **PERF[idx],
    )
    db.add(perf)
    db.commit()
    print(f"  ✅ Performance for {STUDENTS[idx]['name']}")

db.close()

print("\n" + "="*60)
print("Seed complete! Test accounts:")
print("="*60)
for s in STUDENTS:
    print(f"  📧 {s['email']}  🔑 {s['password']}")
print(f"  📧 teacher@academiq.com  🔑 teacher123")
print("="*60)
