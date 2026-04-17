"""
Migration: Add feedback loop tables

Run: python migrate_feedback_loop.py

Adds:
  - les_snapshots       → LES score history per student
  - intervention_log    → tracks when study plans were generated
  - model_versions      → ML retrain history
"""

from sqlalchemy import inspect
import os

# Import engine and Base (which already has all models including feedback loop models)
try:
    from database import engine, Base, LESSnapshot, InterventionLog, ModelVersion
except ImportError as e:
    print(f"Error importing from database.py: {e}")
    print("Make sure you're in the backend directory!")
    exit(1)


# ─── Migration Runner ─────────────────────────────────────────

def run_migration():
    """
    Create all database tables from the Base metadata.
    This includes all models from database.py (users, subjects, etc.)
    and the feedback loop tables (les_snapshots, intervention_log, model_versions).
    """
    print("Initializing database...")

    # Create ALL tables at once (Base.metadata includes everything)
    try:
        Base.metadata.create_all(bind=engine)
        print("✓ Creating tables...")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return

    # Check which tables were created
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    feedback_loop_tables = {
        "les_snapshots": "LES score snapshots",
        "intervention_log": "Intervention tracking",
        "model_versions": "ML model versions",
    }

    created = []
    for table_name, description in feedback_loop_tables.items():
        if table_name in existing_tables:
            created.append(f"{table_name} ({description})")

    print("\n✅ Migration complete")
    if created:
        print("   Tables ready:")
        for table in created:
            print(f"     • {table}")
    else:
        print("   All tables already exist (up to date)")

    # Show all tables
    print(f"\n   Total tables in database: {len(existing_tables)}")
    print()


if __name__ == "__main__":
    run_migration()
