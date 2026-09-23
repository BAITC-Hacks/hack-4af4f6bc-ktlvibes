from test_api import login


def test_registration_login_self_crud_and_logout(client):
    created = client.post("/api/users", json={
        "role": "team", "name": "Новая команда", "email": "new@example.com",
        "password": "test-password", "skills": "Дизайн",
    })
    assert created.status_code == 201
    user = created.json()
    assert user["role"] == "team"
    assert user["points"] == 0
    assert "password" not in user and "password_hash" not in user
    assert client.get(f"/api/users/{user['id']}").status_code == 401
    assert client.post("/api/auth/login", json={"email": "new@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "NEW@example.com", "password": "test-password"}).status_code == 200
    assert client.get("/api/auth/me").json()["id"] == user["id"]
    assert client.get("/api/users").json() == [client.get(f"/api/users/{user['id']}").json()]
    assert client.get("/api/users/1").status_code == 404
    assert client.patch("/api/users/1", json={"name": "Чужое имя"}).status_code == 404
    assert client.delete("/api/users/1").status_code == 404

    changed = client.patch(f"/api/users/{user['id']}", json={"name": "Новая команда 2", "skills": "Разработка", "password": "new-password"})
    assert changed.status_code == 200
    assert changed.json()["skills"] == "Разработка"
    assert client.post("/api/auth/login", json={"email": "new@example.com", "password": "test-password"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "new@example.com", "password": "new-password"}).status_code == 200
    assert client.delete(f"/api/users/{user['id']}").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_users_with_activity_cannot_change_role_or_be_deleted(client):
    login(client, "business", 1)
    task = client.get("/api/tasks").json()[0]
    owner = task["businessId"]
    login(client, "business", owner)
    assert client.patch(f"/api/users/{owner}", json={"role": "team"}).status_code == 409
    assert client.delete(f"/api/users/{owner}").status_code == 409
    login(client, "team", 6)
    team = client.get("/api/auth/me").json()
    assert [item["id"] for item in client.get("/api/teams").json()] == [team["id"]]
    assert client.patch(f"/api/users/{team['id']}", json={"role": "business"}).status_code == 409
    assert client.delete(f"/api/users/{team['id']}").status_code == 409
    assert client.get(f"/api/tasks/{task['id']}").status_code == 200


def test_seed_does_not_recreate_a_renamed_account(client):
    from sqlmodel import Session, select

    from app.db import engine
    from app.models import User
    from seed import seed

    login(client, "business", 1)
    before = len(client.get("/api/users").json())
    assert before == 1
    assert client.patch("/api/users/1", json={"name": "Бизнес с новым именем"}).status_code == 200
    with Session(engine) as session:
        count_before = len(session.exec(select(User)).all())
        seed(session)
        users = session.exec(select(User)).all()
    assert len(users) == count_before
    assert next(user for user in users if user.id == 1).name == "Бизнес с новым именем"
