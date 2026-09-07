"""
Idempotent migration script for the classroom tables.

Run once after pulling the new code:

    python migrate_classroom_tables.py

It checks whether the `classrooms` and `classroom_members` tables exist in
the configured database; if not, it creates them by calling
`Base.metadata.create_all` (which only creates missing tables — never
recreates existing ones).

This is intentionally a no-op on second/third runs.
"""

import sys


def main() -> int:
    from sqlalchemy import inspect

    from database import engine, Base
    import database_classroom  # noqa: F401 — registers the models on Base

    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    wanted = {"classrooms", "classroom_members"}
    missing = wanted - existing

    if not missing:
        print("✓ Classroom tables already exist — nothing to do.")
        return 0

    print(f"Creating classroom tables: {sorted(missing)}")
    Base.metadata.create_all(bind=engine, tables=[
        database_classroom.Classroom.__table__,
        database_classroom.ClassroomMember.__table__,
    ])

    # Verify
    inspector = inspect(engine)
    after = set(inspector.get_table_names())
    if wanted.issubset(after):
        print("✓ Migration complete — `classrooms` and `classroom_members` now exist.")
        return 0

    print(f"✗ Migration FAILED — missing after attempt: {wanted - after}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
