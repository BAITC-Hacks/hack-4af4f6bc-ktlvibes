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
    questions: list[Question] = Field(min_length=1, max_length=1)


PROMPT = """Помоги владельцу бизнеса понятнее описать его задачу для команды, которая будет её решать.
Прочитай исходное описание и заполненные поля. Верни ровно один следующий вопрос. После ответа тебя вызовут снова с обновлённой карточкой. Выбирай незаполненное поле; переходи от текущей ситуации к нужному изменению, пользователям, доступным материалам, результату и проверке успеха. О доступе к данным спрашивай после того, как выяснил, какие данные есть; о целевом значении — после того, как узнал показатель. Если предыдущий ответ не добавил фактов, уточни этот же вопрос проще и конкретнее.

Пиши вопросы на русском языке так, как спросил бы внимательный собеседник без технического образования:
- Простые знакомые слова, вежливое обращение на «вы», один вопрос и одна мысль в каждом пункте.
- Вопрос должен быть конкретным, коротким и понятным без пояснений. Проверь, что он естественно звучит по-русски. Не используй жаргон вроде «KPI», «датасет», «валидация», «интеграция» или «метрика».
- Спрашивай о реальной работе бизнеса: кому это нужно, что происходит сейчас, какой результат нужен, какие примеры есть и как понять, что стало лучше.
- Учитывай детали из описания и предыдущих ответов. Следующий вопрос должен продолжать разговор: уточнять названную проблему или результат, а не начинать новую тему без причины. Не придумывай факты о компании, клиентах, данных или сроках.

Примеры подходящего тона: «Кому сейчас мешает эта проблема?», «Есть ли у вас примеры таких случаев?», «Как вы поймёте, что задача решена?»

Верни только JSON вида {"questions": [{"field": "users", "text": "Кому сейчас мешает эта проблема?"}]}. Для field используй только: context, need, users, dataDescription, dataAccess, constraints, expectedResult, successMetric, successTarget, contact, interactionFormat. Для каждого field задай вопрос, ответ на который заполнит именно это поле."""

TEMPLATES = [
    ("context", "Как сейчас устроен процесс, который вы хотите улучшить?"),
    ("need", "Что именно в этом процессе нужно изменить?"),
    ("users", "Кто столкнётся с этой проблемой или будет пользоваться решением?"),
    ("dataDescription", "Какие примеры или материалы помогут команде разобраться в задаче?"),
    ("dataAccess", "Как команда сможет получить доступ к этим материалам?"),
    ("expectedResult", "Что конкретно команда должна показать или передать вам в конце работы?"),
    ("successMetric", "По какому признаку вы поймёте, что решение помогло?"),
    ("successTarget", "Какой результат по этому признаку вы сочтёте успешным?"),
    ("constraints", "Какие сроки или другие ограничения команде нужно учесть?"),
    ("contact", "По какому адресу почты или номеру команда сможет с вами связаться?"),
    ("interactionFormat", "Как часто и каким способом вы сможете обсуждать работу с командой?"),
]


def fallback(card: dict[str, str]) -> dict:
    missing = [(field, text) for field, text in TEMPLATES if not meaningful(card.get(field, ""), field)]
    questions = []
    for field, text in missing[:1]:
        if field == "dataAccess" and meaningful(card.get("dataDescription", ""), "dataDescription"):
            text = "Вы рассказали о данных. Как команда сможет получить к ним доступ?"
        elif field == "successTarget" and meaningful(card.get("successMetric", ""), "successMetric"):
            text = "Вы назвали показатель. Какое значение будет означать успех?"
        elif field == "expectedResult" and meaningful(card.get("need", ""), "need"):
            text = "Вы описали нужное изменение. Что именно должна подготовить команда?"
        elif field == "need" and meaningful(card.get("context", ""), "context"):
            text = "Вы описали текущую ситуацию. Что в ней нужно изменить в первую очередь?"
        elif field == "successMetric" and meaningful(card.get("expectedResult", ""), "expectedResult"):
            text = "Вы описали результат работы команды. Как вы проверите, что он помог?"
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
        for item in parsed.questions:
            if item.field in missing:
                return {"questions": [item.model_dump()], "source": "llm"}
        return fallback(card)
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, ValidationError):
        return fallback(card)
