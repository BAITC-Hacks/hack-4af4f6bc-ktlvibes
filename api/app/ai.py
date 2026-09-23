import json
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
    questions: list[Question] = Field(min_length=1, max_length=5)


PROMPT = """Помоги владельцу бизнеса понятнее описать его задачу для команды, которая будет её решать.
Прочитай исходное описание и уже заполненные поля после последнего ответа. Выбери до 5 самых важных пробелов; не спрашивай повторно о том, что уже ясно. В интерфейсе человеку покажут первый вопрос, а после его ответа вызовут тебя снова с обновлённой карточкой. Если пробелов осталось меньше трёх, верни только оставшиеся вопросы.

Пиши вопросы на русском языке так, как спросил бы внимательный собеседник без технического образования:
- Простые знакомые слова, вежливое обращение на «вы», один вопрос и одна мысль в каждом пункте.
- Вопрос должен быть конкретным, коротким и понятным без пояснений. Проверь, что он естественно звучит по-русски. Не используй жаргон вроде «KPI», «датасет», «валидация», «интеграция» или «метрика».
- Спрашивай о реальной работе бизнеса: кому это нужно, что происходит сейчас, какой результат нужен, какие примеры есть и как понять, что стало лучше.
- Учитывай детали из описания, если они есть. Не придумывай факты о компании, клиентах, данных или сроках.

Примеры подходящего тона: «Кому сейчас мешает эта проблема?», «Есть ли у вас примеры таких случаев?», «Как вы поймёте, что задача решена?»

Верни только JSON вида {"questions": [{"field": "users", "text": "Кому сейчас мешает эта проблема?"}]}. Для field используй только: context, need, users, dataDescription, dataAccess, constraints, expectedResult, successMetric, successTarget, contact, interactionFormat. Для каждого field задай вопрос, ответ на который заполнит именно это поле."""

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
    questions = []
    for field, text in missing[:5]:
        if field == "dataAccess" and meaningful(card.get("dataDescription", ""), "dataDescription"):
            text = "Вы рассказали о данных. Как команда сможет получить к ним доступ?"
        elif field == "successTarget" and meaningful(card.get("successMetric", ""), "successMetric"):
            text = "Вы назвали показатель. Какое значение будет означать успех?"
        elif field == "expectedResult" and meaningful(card.get("need", ""), "need"):
            text = "Вы описали нужное изменение. Что именно должна подготовить команда?"
        questions.append({"field": field, "text": text})
    return {"questions": questions, "source": "fallback"}


def ask_questions(initial_description: str, card: dict[str, str]) -> dict:
    missing = {field for field, _ in TEMPLATES if not meaningful(card.get(field, ""), field)}
    if not missing:
        return {"questions": [], "source": "fallback"}
    key = os.getenv("AI_API_KEY")
    url = os.getenv("AI_API_URL")
    if not key or not url:
        return fallback(card)
    model = os.getenv("AI_MODEL", "gpt-6-luna")
    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": json.dumps(
                {"initialDescription": initial_description, "card": {k: v for k, v in card.items() if v}},
                ensure_ascii=False,
            )},
        ],
    }
    if model.startswith("gpt-6-astra"):
        payload["reasoning_effort"] = "low"
    elif model.startswith(("gpt-6-sol", "gpt-6-luna")):
        payload["reasoning_effort"] = "none"
    else:
        payload["temperature"] = 0
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
            timeout=8,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = QuestionList.model_validate_json(content)
        questions = []
        seen = set()
        for item in parsed.questions:
            if item.field in missing and item.field not in seen:
                questions.append(item.model_dump())
                seen.add(item.field)
        if questions:
            return {"questions": questions, "source": "llm"}
        return fallback(card)
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, ValidationError):
        return fallback(card)
