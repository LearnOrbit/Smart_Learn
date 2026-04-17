"""
Example tests for Academic Automation API
Run with: pytest test_api.py -v
"""

import pytest


class TestStudents:
    """Student endpoint tests"""

    def test_create_student(self, client):
        """Test creating a new student"""
        response = client.post(
            "/students/",
            json={
                "email": "test@example.com",
                "name": "Test Student",
                "phone": "9999999999"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test Student"
        assert "id" in data

    def test_create_duplicate_email(self, client):
        """Test that duplicate email fails"""
        client.post(
            "/students/",
            json={
                "email": "duplicate@example.com",
                "name": "Student 1"
            }
        )
        response = client.post(
            "/students/",
            json={
                "email": "duplicate@example.com",
                "name": "Student 2"
            }
        )
        assert response.status_code == 400

    def test_list_students(self, client):
        """Test listing students"""
        client.post(
            "/students/",
            json={"email": "alice@example.com", "name": "Alice"}
        )
        client.post(
            "/students/",
            json={"email": "bob@example.com", "name": "Bob"}
        )
        response = client.get("/students/")
        assert response.status_code == 200
        assert len(response.json()) >= 2

    def test_get_student(self, client):
        """Test getting a specific student"""
        create_response = client.post(
            "/students/",
            json={"email": "john@example.com", "name": "John"}
        )
        student_id = create_response.json()["id"]

        response = client.get(f"/students/{student_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "John"

    def test_get_nonexistent_student(self, client):
        """Test getting a non-existent student"""
        response = client.get("/students/9999")
        assert response.status_code == 404

    def test_update_student(self, client):
        """Test updating student information"""
        create_response = client.post(
            "/students/",
            json={"email": "update@example.com", "name": "Original Name"}
        )
        student_id = create_response.json()["id"]

        response = client.put(
            f"/students/{student_id}",
            json={"name": "Updated Name"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_delete_student(self, client):
        """Test deleting a student"""
        create_response = client.post(
            "/students/",
            json={"email": "delete@example.com", "name": "To Delete"}
        )
        student_id = create_response.json()["id"]

        response = client.delete(f"/students/{student_id}")
        assert response.status_code == 204

        response = client.get(f"/students/{student_id}")
        assert response.status_code == 404


class TestCourses:
    """Course endpoint tests"""

    def test_create_course(self, client):
        """Test creating a course"""
        response = client.post(
            "/courses/",
            json={
                "code": "CS101",
                "name": "Intro to Programming",
                "semester": 1,
                "department": "Computer Science"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "CS101"
        assert data["semester"] == 1

    def test_list_courses(self, client):
        """Test listing courses"""
        client.post(
            "/courses/",
            json={
                "code": "CS201",
                "name": "Data Structures",
                "semester": 2,
                "department": "CS"
            }
        )
        response = client.get("/courses/")
        assert response.status_code == 200

    def test_enroll_student_in_course(self, client):
        """Test enrolling student in course"""
        student_resp = client.post(
            "/students/",
            json={"email": "enroll@example.com", "name": "Enroll Test"}
        )
        student_id = student_resp.json()["id"]

        course_resp = client.post(
            "/courses/",
            json={
                "code": "CS301",
                "name": "Advanced Topics",
                "semester": 3,
                "department": "CS"
            }
        )
        course_id = course_resp.json()["id"]

        response = client.post(f"/courses/{course_id}/enroll/{student_id}")
        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()


class TestAssessments:
    """Assessment endpoint tests"""

    def test_create_assessment(self, client):
        """Test creating an assessment"""
        course_resp = client.post(
            "/courses/",
            json={
                "code": "CS401",
                "name": "Advanced Programming",
                "semester": 4,
                "department": "CS"
            }
        )
        course_id = course_resp.json()["id"]

        response = client.post(
            "/assessments/",
            json={
                "course_id": course_id,
                "title": "Midterm Exam",
                "assessment_type": "mcq",
                "total_marks": 100,
                "duration_minutes": 60
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Midterm Exam"


class TestAnalytics:
    """Analytics endpoint tests"""

    def test_co_attainment(self, client):
        """Test CO attainment calculation"""
        course_resp = client.post(
            "/courses/",
            json={
                "code": "CS501",
                "name": "Analytics Test Course",
                "semester": 5,
                "department": "CS"
            }
        )
        course_id = course_resp.json()["id"]

        co_resp = client.post(
            "/course-outcomes/",
            json={
                "course_id": course_id,
                "code": "CO_TEST",
                "description": "Test outcome",
                "bloom_level": "Apply"
            }
        )

        assess_resp = client.post(
            "/assessments/",
            json={
                "course_id": course_id,
                "title": "Test Assessment",
                "assessment_type": "mcq",
                "total_marks": 100
            }
        )

        response = client.get(f"/analytics/course/{course_id}/co-attainment")
        assert response.status_code == 200
        data = response.json()
        assert data["course_id"] == course_id
        assert "co_attainments" in data

    def test_student_performance(self, client):
        """Test student performance analytics"""
        student_resp = client.post(
            "/students/",
            json={"email": "perf@example.com", "name": "Performance Test"}
        )
        student_id = student_resp.json()["id"]

        response = client.get(f"/analytics/student/{student_id}/performance")
        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == student_id
        assert "performance_details" in data

    def test_po_attainment(self, client):
        """Test Program Outcome attainment calculation with CO-PO mapping"""
        po_resp = client.post(
            "/program-outcomes/",
            json={
                "code": "PO_TEST",
                "description": "Test Program Outcome"
            }
        )
        po_id = po_resp.json()["id"]

        course_resp = client.post(
            "/courses/",
            json={
                "code": "CS601",
                "name": "PO Test Course",
                "semester": 6,
                "department": "CS"
            }
        )
        course_id = course_resp.json()["id"]

        co_resp = client.post(
            "/course-outcomes/",
            json={
                "course_id": course_id,
                "code": "CO_PO_TEST",
                "description": "CO for PO test",
                "bloom_level": "Analyze"
            }
        )
        co_id = co_resp.json()["id"]

        mapping_resp = client.post(
            "/co-po-mappings/",
            json={
                "course_outcome_id": co_id,
                "program_outcome_id": po_id,
                "correlation_level": "strong",
                "correlation_value": 0.9
            }
        )
        assert mapping_resp.status_code == 201

        response = client.get(f"/analytics/program/{po_id}/po-attainment")
        assert response.status_code == 200
        data = response.json()
        assert data["po_id"] == po_id
        assert "attainment_percentage" in data
        assert "attainment_level" in data
        assert data["total_mapped_cos"] == 1

    def test_po_attainment_nonexistent(self, client):
        """Test PO attainment for non-existent PO"""
        response = client.get("/analytics/program/9999/po-attainment")
        assert response.status_code == 404


class TestHealth:
    """Health check tests"""

    def test_health_check(self, client):
        """Test health endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
