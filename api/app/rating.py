import re
from collections.abc import Mapping


WEIGHTS = (
    ("context", 10, "Опишите контекст задачи подробнее."),
    ("need", 10, "Опишите потребность или желаемое изменение."),
    ("dataDescription", 10, "Опишите доступные данные или приведите примеры."),
    ("dataAccess", 10, "Укажите источник данных и способ доступа."),
    ("expectedResult", 15, "Опишите конкретный ожидаемый результат."),
    ("successMetric", 10, "Укажите метрику или проверяемое условие успеха."),
    ("successTarget", 5, "Укажите целевое значение или условие принятия."),
    ("constraints", 10, "Опишите ограничения или явно укажите, что их нет."),
    ("users", 10, "Укажите целевых пользователей."),
    ("contact", 5, "Укажите email или телефон для связи."),
    ("interactionFormat", 5, "Опишите формат консультаций и обратной связи."),
)

PLACEHOLDERS = {"позже", "не знаю", "нет", "-", "n/a", "tbd", "todo", "test", "тест", "данных нет", "неизвестно"}


def get_level(score: int) -> str:
    if score < 40:
        return "черновик"
    if score < 70:
        return "рабочая"
    if score < 90:
        return "готовая"
    return "приоритетная"


def meaningful(value: str, key: str) -> bool:
    value = " ".join(value.strip().split())
    if not value or value.casefold().strip(".!? ") in PLACEHOLDERS:
        return False
    if key == "contact":
        return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value) or re.fullmatch(r"\+?[\d\s()\-]{10,20}", value))
    if key == "constraints" and value.casefold() in {"ограничений нет", "нет ограничений", "без ограничений"}:
        return True
    if key == "dataDescription" and "данных нет" in value.casefold():
        return False
    return len(re.sub(r"[^\w]", "", value, flags=re.UNICODE)) >= 12


def score_task(card: Mapping[str, str]) -> dict:
    breakdown = []
    missing = []
    for key, weight, hint in WEIGHTS:
        earned = weight if meaningful(card.get(key, ""), key) else 0
        breakdown.append({"key": key, "earned": earned, "max": weight})
        if not earned:
            missing.append({"key": key, "hint": hint})
    total = sum(part["earned"] for part in breakdown)
    return {"total": total, "level": get_level(total), "breakdown": breakdown, "missing": missing}
