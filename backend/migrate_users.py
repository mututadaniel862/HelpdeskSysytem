import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("No DATABASE_URL found")
    exit(1)

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Adding columns to users table...")
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN department VARCHAR;')
        print("Added 'department' column.")
    except Exception as e:
        print(f"dept exist: {e}")
        
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN reason VARCHAR;')
        print("Added 'reason' column.")
    except Exception as e:
        print(f"reason exist: {e}")
        
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN "isApproved" BOOLEAN DEFAULT false;')
        print("Added 'isApproved' column.")
    except Exception as e:
        print(f"isApproved exist: {e}")
        
    cursor.close()
    conn.close()
    print("Migration complete!")
except Exception as e:
    print(f"Error: {e}")
