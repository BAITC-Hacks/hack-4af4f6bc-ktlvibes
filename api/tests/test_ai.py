import json
from unittest.mock import Mock, patch

import pytest

from app.ai import ask_questions


@pytest.mark.parametrize(
    ("model", "effort"),
    [("gpt-6-luna", "none"), ("gpt-6-sol", "none"), ("gpt-6-astra", "low")],
)
def test_latest_models_use_supported_chat_parameters(monkeypatch, model, effort):
    monkeypatch.setenv("AI_API_KEY", "test-key")
    monkeypatch.setenv("AI_API_URL", "https://api.openai.com/v1/chat/completions")
    monkeypatch.setenv("AI_MODEL", model)
    response = Mock()
    response.json.return_value = {"choices": [{"message": {"content": json.dumps({"questions": [
        {"field": "users", "text": "Какие пользователи сталкиваются с проблемой?"},
        {"field": "dataDescription", "text": "Какие данные доступны для решения задачи?"},
        {"field": "successMetric", "text": "Как измерить успешность результата?"},
    ]})}}]}

    with patch("app.ai.httpx.post", return_value=response) as post:
        result = ask_questions("Исходное описание", {"topic": "Сервис", "context": ""})

    payload = post.call_args.kwargs["json"]
    assert payload["model"] == model
    assert payload["reasoning_effort"] == effort
    assert "temperature" not in payload
    assert json.loads(payload["messages"][1]["content"])["card"] == {"topic": "Сервис"}
    assert result["source"] == "llm"
    assert len(result["questions"]) == 3
