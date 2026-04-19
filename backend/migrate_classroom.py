"""
Migration: add classroom_id and status columns to assignments table.
Run once: python migrate_classroom.py
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "core_quest.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("PRAGMA table_info(assignments)")
cols = [row[1] for row in cur.fetchall()]
print("Existing columns:", cols)

if "classroom_id" not in cols:
    cur.execute("ALTER TABLE assignments ADD COLUMN classroom_id TEXT")
    print("Added classroom_id column")
else:
    print("classroom_id already exists — skipping")

if "status" not in cols:
    default_val = "draft"
    cur.execute(f"ALTER TABLE assignments ADD COLUMN status TEXT DEFAULT '{default_val}'")
    print("Added status column")
else:
    print("status already exists — skipping")

conn.commit()
conn.close()
print("Migration complete.")
