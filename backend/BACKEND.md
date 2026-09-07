# Smart Learn Backend

FastAPI backend for Smart Learn, an academic learning and analytics platform.
It provides authentication, outcome management, assignments, submissions,
classrooms, announcements, AI advisory features, and learning analytics.

## Technology

- Python 3.10+
- FastAPI and Uvicorn
- SQLAlchemy ORM
- SQLite by default, with PostgreSQL support through `DATABASE_URL`
- JWT authentication with bcrypt password hashing
- scikit-learn and SciPy for analytics
- Anthropic API for optional AI advisory features

## Project Files

| File | Purpose |
| --- | --- |
| `main.py` | FastAPI application and API routes |
| `database.py` | SQLAlchemy engine, models, and database dependency |
| `database_classroom.py` | Classroom and classroom membership models |
| `schemas.py` | Pydantic request and response schemas |
| `auth.py` | Password hashing and JWT helpers |
| `ml_models.py` | Student performance and risk prediction |
| `les_engine.py` | Learning Efficiency Score and feedback loop |
| `statistical_validation.py` | Intervention and model validation |
| `ai_advisory.py` | Optional Anthropic-powered study advice |
| `outcome_parser.py` | PO, CO, and LO text extraction |
| `migrate_*.py` | Database migration scripts |
| `seed_*.py` | Development and demo data scripts |

## Setup

Run these commands from the `backend` directory:

```bash
cd Smart_Learn/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

On Windows, activate the environment with:

```powershell
venv\Scripts\activate
```

The repository already contains `venv311`, which can be used instead when it
is compatible with the local Python installation:

```bash
source venv311/bin/activate
```

## Environment Variables

Create `backend/.env` for local backend settings:

```env
DATABASE_URL=sqlite:///./core_quest.db
SECRET_KEY=replace-with-a-long-random-secret
ANTHROPIC_API_KEY=optional-anthropic-api-key
```

The application defaults to `sqlite:///./core_quest.db` when `DATABASE_URL` is
not set. Do not commit API keys, passwords, or production secrets.

## Run the API

From `backend/` with the virtual environment activated:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8002
```

Useful URLs:

- API base: `http://localhost:8002`
- Swagger UI: `http://localhost:8002/docs`
- ReDoc: `http://localhost:8002/redoc`
- Health check: `http://localhost:8002/health`

The frontend expects the API at `http://localhost:8002/api` according to its
environment configuration. Some legacy routes in `main.py` are mounted at the
root path, so check `/docs` for the authoritative route list.

## Authentication

Authentication uses a bearer token:

```text
Authorization: Bearer <access-token>
```

For a local development database, the application seeds default accounts when
the users table is empty:

| Role | Email | Password |
| --- | --- | --- |
| Teacher | `teacher@academiq.com` | `teacher123` |
| Student | `student@academiq.com` | `student123` |

Change these credentials before using the application outside local testing.

## Database

Tables are created automatically at application startup for local development.
For an existing database, run only the migrations needed for the schema version
you are using:

```bash
python migrate_assignments.py
python migrate_pdf_path.py
python migrate_classroom.py
python migrate_classroom_tables.py
python migrate_announcements.py
python migrate_feedback_loop.py
```

The main database file is `core_quest.db`. Back it up before running migrations
or seed scripts.

## Demo Data

The following scripts add local test data. They are not required for production:

```bash
python seed_test_students.py
python seed_sample_les.py
```

Use the `check_*.py`, `list_students.py`, and `debug_*.py` scripts to inspect
local users, student performance, and analytics responses.

## Testing

Install development dependencies and run the backend tests from `backend/`:

```bash
pip install -r requirements-dev.txt
pytest
```

Tests use an in-memory SQLite database through the fixtures in `conftest.py`.

## Common Issues

### Port already in use

Run Uvicorn on another port and update the frontend API URL:

```bash
uvicorn main:app --reload --port 8003
```

### Missing Python package

Confirm the virtual environment is active, then reinstall dependencies:

```bash
python -m pip install -r requirements.txt
```

### AI advisory is unavailable

AI advisory endpoints require `ANTHROPIC_API_KEY`. Core authentication,
database, classroom, assignment, and analytics functionality can run without
the optional key where the endpoint provides a fallback.

### Database schema is outdated

Stop the server, back up `core_quest.db`, run the relevant migration, and then
restart the API.

## Frontend Integration

Start the frontend from the project root in a separate terminal:

```bash
cd Smart_Learn
npm install
npm run dev
```

The Vite development server runs on port `8080` in this project. Make sure the
backend CORS configuration and frontend API URL use the same backend port.