from sqlalchemy import create_engine, inspect, text
from sqlmodel import SQLModel

from app.db import engine
from app.passwords import verify_password
from app.user_migration import migrate_legacy_users, migrate_user_credentials


def test_legacy_business_and_team_links_survive_migration():
    assert engine.url.database == "aisana_test"
    schema = "user_migration_case"
    with engine.begin() as connection:
        connection.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        connection.execute(text(f"CREATE SCHEMA {schema}"))
    legacy_engine = create_engine(engine.url, connect_args={"options": f"-csearch_path={schema}"})
    try:
        with legacy_engine.begin() as connection:
            connection.execute(text("CREATE TABLE business (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)"))
            connection.execute(text("CREATE TABLE team (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, interests TEXT NOT NULL, skills TEXT NOT NULL, technologies TEXT NOT NULL, points INTEGER NOT NULL)"))
            connection.execute(text("CREATE TABLE task (id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES business(id))"))
            connection.execute(text("CREATE TABLE proposal (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES team(id))"))
            connection.execute(text("CREATE TABLE progressconfirmation (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES team(id))"))
            connection.execute(text("INSERT INTO business VALUES (1, 'Бизнес'), (2, 'Другой бизнес')"))
            connection.execute(text("INSERT INTO team VALUES (1, 'Команда', 'Город', 'Аналитика', 'Python', 20)"))
            connection.execute(text("INSERT INTO task VALUES (1, 1)"))
            connection.execute(text("INSERT INTO proposal VALUES (1, 1)"))
            connection.execute(text("INSERT INTO progressconfirmation VALUES (1, 1)"))

        SQLModel.metadata.create_all(legacy_engine)
        migrate_legacy_users(legacy_engine)
        migrate_legacy_users(legacy_engine)
        migrate_user_credentials(legacy_engine)
        migrate_user_credentials(legacy_engine)

        with legacy_engine.connect() as connection:
            assert connection.execute(text("SELECT id, role, name, points FROM users ORDER BY id")).all() == [
                (1, "business", "Бизнес", 0),
                (2, "business", "Другой бизнес", 0),
                (3, "team", "Команда", 20),
            ]
            assert connection.execute(text("SELECT business_id FROM task")).scalar_one() == 1
            assert connection.execute(text("SELECT team_id FROM proposal")).scalar_one() == 3
            assert connection.execute(text("SELECT team_id FROM progressconfirmation")).scalar_one() == 3
            email, stored = connection.execute(text("SELECT email, password_hash FROM users WHERE id = 3")).one()
            assert email == "demo-team-3@example.local"
            assert verify_password("demo12345", stored)
            for table in ("task", "proposal", "progressconfirmation"):
                assert any(key["referred_table"] == "users" for key in inspect(connection).get_foreign_keys(table))
    finally:
        legacy_engine.dispose()
        with engine.begin() as connection:
            connection.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
