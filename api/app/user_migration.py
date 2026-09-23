"""Move existing business/team records to the shared users table once."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from .models import User
from .passwords import demo_password, hash_password


def demo_email(role: str, user_id: int) -> str:
    return f"demo-{role}-{user_id}@example.local"


def migrate_legacy_users(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not {"business", "team", "task", "proposal", "progressconfirmation"}.issubset(inspector.get_table_names()):
            return

        references = {
            "task": ("business_id", "business"),
            "proposal": ("team_id", "team"),
            "progressconfirmation": ("team_id", "team"),
        }
        legacy_keys = {}
        for table, (column, target) in references.items():
            keys = [key for key in inspector.get_foreign_keys(table)
                    if key["constrained_columns"] == [column] and key["referred_table"] == target]
            if keys:
                legacy_keys[table] = keys[0]["name"]
        if not legacy_keys:
            return
        if len(legacy_keys) != len(references):
            raise RuntimeError("Legacy user migration found a partially converted schema")
        if connection.execute(text("SELECT COUNT(*) FROM users")).scalar_one():
            raise RuntimeError("Legacy user migration requires an empty users table")

        business_offset = connection.execute(text("SELECT COALESCE(MAX(id), 0) FROM business")).scalar_one()
        connection.execute(text(
            "INSERT INTO users (id, role, name, interests, skills, technologies, points) "
            "SELECT id, 'business', name, '', '', '', 0 FROM business"
        ))
        connection.execute(text(
            "INSERT INTO users (id, role, name, interests, skills, technologies, points) "
            "SELECT id + :offset, 'team', name, interests, skills, technologies, points FROM team"
        ), {"offset": business_offset})

        quote = connection.dialect.identifier_preparer.quote
        for table, key in legacy_keys.items():
            connection.execute(text(f"ALTER TABLE {quote(table)} DROP CONSTRAINT {quote(key)}"))
        connection.execute(text("UPDATE proposal SET team_id = team_id + :offset"), {"offset": business_offset})
        connection.execute(text("UPDATE progressconfirmation SET team_id = team_id + :offset"), {"offset": business_offset})
        for table, (column, _) in references.items():
            connection.execute(text(
                f"ALTER TABLE {quote(table)} ADD CONSTRAINT {quote(table + '_' + column + '_users_fkey')} "
                f"FOREIGN KEY ({quote(column)}) REFERENCES users(id)"
            ))
        connection.execute(text(
            "SELECT setval(pg_get_serial_sequence('users', 'id'), "
            "GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1), true)"
        ))


def migrate_user_credentials(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email))"))
        for user_id, role, email, stored in connection.execute(text(
            "SELECT id, role, email, password_hash FROM users WHERE email IS NULL OR password_hash IS NULL"
        )).all():
            connection.execute(text(
                "UPDATE users SET email = :email, password_hash = :password_hash WHERE id = :id"
            ), {
                "id": user_id,
                "email": email or demo_email(role, user_id),
                "password_hash": stored or hash_password(demo_password()),
            })


def assign_seed_credentials(session: Session) -> None:
    changed = False
    for user in session.exec(select(User).where((User.email == None) | (User.password_hash == None))).all():
        user.email = user.email or demo_email(user.role, user.id)
        user.password_hash = user.password_hash or hash_password(demo_password())
        session.add(user)
        changed = True
    if changed:
        session.commit()
