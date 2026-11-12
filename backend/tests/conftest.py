import os

# Unit tests never touch the database; give SQLAlchemy a parseable URL that overrides backend/.env.
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@localhost:5432/test"
os.environ["MOCK_AI"] = "true"
