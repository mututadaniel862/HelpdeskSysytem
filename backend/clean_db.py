from database import engine
from sqlalchemy import text

if __name__ == "__main__":
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()
    print("Database wiped successfully.")
