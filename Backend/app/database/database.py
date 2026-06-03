from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Try to connect to MySQL; fall back to local SQLite if it fails or configuration is incomplete
if DB_USER and DB_PASSWORD and DB_HOST and DB_NAME:
    DATABASE_URL = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT or 3306}/{DB_NAME}"
    )
    try:
        # Create engine with a low timeout to detect offline database quickly
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 2})
        # Verify connection
        with engine.connect() as conn:
            pass
        print("Connected to MySQL database successfully.")
    except Exception as e:
        print(f"MySQL connection failed ({e}). Falling back to local SQLite database...")
        DATABASE_URL = "sqlite:///./qms.db"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    print("MySQL configuration incomplete in environment. Using local SQLite database...")
    DATABASE_URL = "sqlite:///./qms.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()