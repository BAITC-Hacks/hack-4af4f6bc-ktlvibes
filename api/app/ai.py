import os

import httpx
from pydantic import BaseModel, Field, ValidationError
from typing import Literal

from .rating import meaningful

QuestionField = Literal["context", "need", "users", "dataDescription", "dataAccess", "constraints", "expectedResult", "successMetric", "successTarget", "contact", "interactionFormat"]


class Question(BaseModel):
    field: QuestionField
    text: str = Field(min_length=8, max_length=240)


class QuestionList(BaseModel):
    questions: list[Question] = Field(min_length=3, max_length=5)


PROMPT = "Определи недостающие или неясные сведения в описании бизнес-задачи. Верни только JSON по заданной схеме с 3–5 короткими вопросами на русском, каждый с field из разрешённого списка. Не утверждай факты о компании, клиентах, данных или сроках, которых нет во входе. Если поля заполнены, спроси о конкретике или способе проверки."

TEMPLATES = [
    ("users", "Какие группы пользователей сталкиваются с этой задачей?"),
    ("dataDescription", "Какие данные или примеры доступны для решения?"),
    ("successMetric", "По какому показателю вы оцените результат?"),
    ("need", "Какое изменение вы хотите получить?"),
    ("dataAccess", "Где находятся данные и как команда получит к ним доступ?"),
    ("expectedResult", "Каким должен быть конкретный результат работы?"),
    ("successTarget", "Какое значение показателя будет успехом?"),
    ("constraints", "Какие ограничения нужно учитывать?"),
    ("context", "Что происходит сейчас и почему это важно?"),
    ("contact", "Как команда сможет связаться с вами?"),
    ("interactionFormat", "В каком формате вы сможете давать обратную связь?"),
]


def fallback(card: dict[str, str]) -> dict:
    missing = [(field, text) for field, text in TEMPLATES if not meaningful(card.get(field, ""), field)]
    selected = (missing + [entry for entry in TEMPLATES if entry not in missing])[:5]
    return {"questions": [{"field": field, "text": text} for field, text in selected], "source": "fallback"}


def ask_questions(initial_description: str, card: dict[str, str]) -> dict:
    key = os.getenv("AI_API_KEY")
    url = os.getenv("AI_API_URL")
    if not key or not url:
        return fallback(card)
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            json={"model": os.getenv("AI_MODEL", "gpt-4o-mini"), "temperature": 0, "response_format": {"type": "json_object"}, "messages": [
                {"role": "system", "content": PROMPT},
                {"role": "user", "content": __import__("json").dumps({"initialDescription": initial_description, "card": {k: v for k, v in card.items() if v}}, ensure_ascii=False)},
            ]},
            timeout=8,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = QuestionList.model_validate_json(content)
        return {"questions": [item.model_dump() for item in parsed.questions], "source": "llm"}
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, ValidationError):
        return fallback(card)
