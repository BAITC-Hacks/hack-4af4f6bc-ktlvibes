from unittest.mock import patch


def login(client, role, user_id):
    client.post("/api/auth/logout")
    response = client.post("/api/auth/login", json={
        "email": f"demo-{role}-{user_id}@example.local", "password": "demo12345",
    })
    assert response.status_code == 200
    assert response.json()["role"] == role


def test_publish_preview_catalog_and_ownership(client):
    assert client.get("/api/tasks").status_code == 401
    login(client, "business", 1)
    owner = client.get("/api/auth/me").json()["id"]
    draft = client.post("/api/tasks/drafts", json={"initialDescription": "Клиенты ждут ответа", "topic": "Поддержка"})
    assert draft.status_code == 201
    task_id = draft.json()["id"]
    card = {"title": "Сократить ожидание ответа", "topic": "Поддержка", "context": "Клиенты долго ждут ответа поддержки"}
    assert client.post(f"/api/tasks/{task_id}/score-preview", json={"card": card}).json()["total"] == 10
    assert client.get(f"/api/tasks/{task_id}").json()["status"] == "draft"

    login(client, "business", 2)
    assert client.put(f"/api/tasks/{task_id}/confirm", json={"card": card}).status_code == 404
    assert client.get(f"/api/tasks/{task_id}").status_code == 404
    login(client, "team", 6)
    assert client.get(f"/api/tasks/{task_id}").status_code == 404
    assert client.get(f"/api/tasks/{task_id}", headers={"X-Demo-Actor-Id": str(owner)}).status_code == 404
    assert client.post("/api/tasks/drafts", json={"initialDescription": "Чужой черновик"}).status_code == 404

    login(client, "business", owner)
    assert client.put(f"/api/tasks/{task_id}/confirm", json={"card": {"topic": "Поддержка"}}).status_code == 400
    published = client.put(f"/api/tasks/{task_id}/confirm", json={"card": card})
    assert published.status_code == 200
    assert published.json()["score"] == 10
    assert any(t["id"] == task_id for t in client.get("/api/tasks", params={"level": "черновик"}).json())
    updated = client.put(f"/api/tasks/{task_id}/confirm", json={"card": {**card, "need": "Нужно сократить время ответа клиентам"}})
    assert updated.json()["score"] == 20


def test_fallback_proposals_progress_once(client):
    login(client, "business", 1)
    task = client.get("/api/tasks").json()[0]
    owner = task["businessId"]
    login(client, "business", owner)
    with patch("app.ai.httpx.post", side_effect=__import__("httpx").TimeoutException("timeout")), patch.dict("os.environ", {"AI_API_KEY": "x", "AI_API_URL": "https://example.com"}):
        result = client.post(f"/api/tasks/{task['id']}/questions", json={"initialDescription": "Слабое описание", "card": {}})
    assert result.json()["source"] == "fallback"
    assert 3 <= len(result.json()["questions"]) <= 5
    with patch("app.ai.httpx.post") as ai_post, patch.dict("os.environ", {"AI_API_KEY": "x", "AI_API_URL": "https://example.com"}):
        ai_post.return_value.json.return_value = {"choices": [{"message": {"content": "not JSON"}}]}
        invalid = client.post(f"/api/tasks/{task['id']}/questions", json={"initialDescription": "Слабое описание", "card": {}})
    assert invalid.json()["source"] == "fallback"

    teams = client.get("/api/teams").json()[:2]
    payload = {"idea": "Сделать прототип", "plan": "Собрать данные", "duration": "2 недели", "prototypeUrl": "https://example.com/demo"}
    created = []
    for item in teams:
        login(client, "team", item["id"])
        if item == teams[0]:
            assert client.post(f"/api/tasks/{task['id']}/proposals", json={**payload, "prototypeUrl": "ftp://bad"}).status_code == 400
        created.append(client.post(f"/api/tasks/{task['id']}/proposals", json=payload).json())
        assert len(client.get(f"/api/tasks/{task['id']}/my-proposals").json()) >= 1
        assert client.get(f"/api/tasks/{task['id']}/proposals").status_code == 404

    login(client, "business", owner)
    assert len(client.get(f"/api/tasks/{task['id']}/proposals").json()) >= 2
    assert client.post(f"/api/tasks/{task['id']}/progress", json={"teamId": teams[0]["id"], "note": "Есть результат"}).status_code == 409
    assert client.patch(f"/api/proposals/{created[0]['id']}/status", json={"status": "selected"}).status_code == 200
    assert client.patch(f"/api/proposals/{created[1]['id']}/status", json={"status": "rejected"}).status_code == 200
    first = client.post(f"/api/tasks/{task['id']}/progress", json={"teamId": teams[0]["id"], "note": "Прототип проверен"})
    assert first.status_code == 201
    assert first.json()["team"]["points"] == teams[0]["points"] + 10
    assert client.post(f"/api/tasks/{task['id']}/progress", json={"teamId": teams[0]["id"], "note": "Снова"}).status_code == 409
    assert len(client.get(f"/api/tasks/{task['id']}/progress").json()) == 1
