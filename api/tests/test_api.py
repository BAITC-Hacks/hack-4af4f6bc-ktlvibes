from unittest.mock import patch

def headers(actor):
    return {"X-Demo-Actor-Id": str(actor)}


def test_publish_preview_catalog_and_ownership(client):
    actors = client.get("/api/demo-actors").json()
    owner = actors["businesses"][0]["id"]
    stranger = actors["businesses"][1]["id"]
    draft = client.post("/api/tasks/drafts", headers=headers(owner), json={"initialDescription": "Клиенты ждут ответа", "topic": "Поддержка"})
    assert draft.status_code == 201
    task_id = draft.json()["id"]
    card = {"title": "Сократить ожидание ответа", "topic": "Поддержка", "context": "Клиенты долго ждут ответа поддержки"}
    preview = client.post(f"/api/tasks/{task_id}/score-preview", headers=headers(owner), json={"card": card})
    assert preview.json()["total"] == 10
    assert client.get(f"/api/tasks/{task_id}", headers=headers(owner)).json()["status"] == "draft"
    assert client.put(f"/api/tasks/{task_id}/confirm", headers=headers(stranger), json={"card": card}).status_code == 404
    assert client.put(f"/api/tasks/{task_id}/confirm", headers=headers(owner), json={"card": {"topic": "Поддержка"}}).status_code == 400
    assert client.get(f"/api/tasks/{task_id}", headers=headers(owner)).json()["status"] == "draft"
    published = client.put(f"/api/tasks/{task_id}/confirm", headers=headers(owner), json={"card": card})
    assert published.status_code == 200
    assert published.json()["score"] == 10
    assert any(t["id"] == task_id for t in client.get("/api/tasks", params={"level": "черновик"}).json())
    assert all(t["status"] == "published" for t in client.get("/api/tasks").json())
    updated = client.put(f"/api/tasks/{task_id}/confirm", headers=headers(owner), json={"card": {**card, "need": "Нужно сократить время ответа клиентам"}})
    assert updated.json()["score"] == 20
    assert any(t["id"] == task_id for t in client.get("/api/tasks", params={"topic": "Поддержка"}).json())


def test_fallback_proposals_progress_once(client):
    actors = client.get("/api/demo-actors").json()
    task = client.get("/api/tasks").json()[0]
    owner = task["businessId"]
    teams = actors["teams"][:2]
    with patch("app.ai.httpx.post", side_effect=__import__("httpx").TimeoutException("timeout")), patch.dict("os.environ", {"AI_API_KEY": "x", "AI_API_URL": "https://example.com"}):
        result = client.post(f"/api/tasks/{task['id']}/questions", headers=headers(owner), json={"initialDescription": "Слабое описание", "card": {}})
    assert result.json()["source"] == "fallback"
    assert 3 <= len(result.json()["questions"]) <= 5
    with patch("app.ai.httpx.post") as ai_post, patch.dict("os.environ", {"AI_API_KEY": "x", "AI_API_URL": "https://example.com"}):
        ai_post.return_value.json.return_value = {"choices": [{"message": {"content": "not JSON"}}]}
        invalid = client.post(f"/api/tasks/{task['id']}/questions", headers=headers(owner), json={"initialDescription": "Слабое описание", "card": {}})
    assert invalid.json()["source"] == "fallback"
    payload = {"idea": "Сделать прототип", "plan": "Собрать данные", "duration": "2 недели", "prototypeUrl": "https://example.com/demo"}
    assert client.post(f"/api/tasks/{task['id']}/proposals", headers=headers(teams[0]["id"]), json={**payload, "prototypeUrl": "ftp://bad"}).status_code == 400
    created = [client.post(f"/api/tasks/{task['id']}/proposals", headers=headers(t["id"]), json=payload).json() for t in teams]
    assert len(client.get(f"/api/tasks/{task['id']}/my-proposals", headers=headers(teams[0]["id"])).json()) >= 1
    assert len(client.get(f"/api/tasks/{task['id']}/proposals", headers=headers(owner)).json()) >= 2
    assert client.post(f"/api/tasks/{task['id']}/progress", headers=headers(owner), json={"teamId": teams[0]["id"], "note": "Есть результат"}).status_code == 409
    assert client.patch(f"/api/proposals/{created[0]['id']}/status", headers=headers(owner), json={"status": "selected"}).status_code == 200
    assert client.patch(f"/api/proposals/{created[1]['id']}/status", headers=headers(owner), json={"status": "rejected"}).status_code == 200
    first = client.post(f"/api/tasks/{task['id']}/progress", headers=headers(owner), json={"teamId": teams[0]["id"], "note": "Прототип проверен"})
    assert first.status_code == 201
    assert first.json()["team"]["points"] == teams[0]["points"] + 10
    assert client.post(f"/api/tasks/{task['id']}/progress", headers=headers(owner), json={"teamId": teams[0]["id"], "note": "Снова"}).status_code == 409
    assert len(client.get(f"/api/tasks/{task['id']}/progress", headers=headers(owner)).json()) == 1
