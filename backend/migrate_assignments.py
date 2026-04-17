import sqlite3
conn = sqlite3.connect('core_quest.db')
c = conn.cursor()
c.execute('PRAGMA table_info(assignments)')
cols = [row[1] for row in c.fetchall()]
print('Current columns:', cols)
if 'subject_id' not in cols:
    c.execute('ALTER TABLE assignments ADD COLUMN subject_id VARCHAR')
    print('Added subject_id')
if 'total_marks' not in cols:
    c.execute('ALTER TABLE assignments ADD COLUMN total_marks INTEGER')
    print('Added total_marks')
if 'generation_method' not in cols:
    c.execute(
        'ALTER TABLE assignments ADD COLUMN generation_method VARCHAR DEFAULT "manual"')
    print('Added generation_method')
conn.commit()
conn.close()
print('Done')
