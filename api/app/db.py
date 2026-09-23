import os

from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from .user_migration import migrate_legacy_users, migrate_user_credentials

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://aisana:aisana@localhost:5432/aisana")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def create_schema() -> None:
    SQLModel.metadata.create_all(engine)
    migrate_legacy_users(engine)
    migrate_user_credentials(engine)


def get_session():
    with Session(engine) as session:
        yield session
