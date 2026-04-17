import sqlite3

conn = sqlite3.connect("core_quest.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(submissions)")
cols = [row[1] for row in cursor.fetchall()]
if "pdf_path" not in cols:
    cursor.execute("ALTER TABLE submissions ADD COLUMN pdf_path TEXT")
    conn.commit()
    print("Added pdf_path column to submissions")
else:
    print("pdf_path column already exists")
conn.close()
