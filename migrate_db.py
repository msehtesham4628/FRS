import sqlite3
import os

db_path = 'backend/sql_app.db'
if not os.path.exists(db_path):
    print("Database not found, skipping migration.")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def add_column(table, column, type_):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {type_}")
        print(f"Added column {column} to {table}")
    except sqlite3.OperationalError:
        print(f"Column {column} already exists in {table}")

# Migrations for survey_submissions
add_column('survey_submissions', 'started_at', 'DATETIME')
add_column('survey_submissions', 'completed_at', 'DATETIME')
add_column('survey_submissions', 'overall_score', 'FLOAT DEFAULT 0.0')

# Migrations for question_responses
add_column('question_responses', 'face_detected', 'BOOLEAN DEFAULT 1')

conn.commit()
conn.close()
print("Migration completed successfully!")
