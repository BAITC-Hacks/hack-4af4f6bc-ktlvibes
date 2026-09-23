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
UNINFORMATIVE = re.compile(
    r"(?:пока\s+)?(?:не\s+зна(?:ю|ем)|неизвестно|позже\s+уточн\w*|"
    r"уточн\w*\s+позже|потом\s+(?:уточн\w*|расскаж\w*)|"
    r"нет\s+(?:данных|информации|примеров|материалов)|"
    r"(?:данных|информации|примеров|материалов)\s+нет|как\s+обычно|всё\s+как\s+всегда|"
    r"то\s+же\s+самое|без\s+изменений|тест|проверка|заглушка)",
    re.IGNORECASE,
)
FILLER_WORDS = {"это", "всё", "все", "как", "для", "будет", "нужно", "надо", "очень", "просто", "хорошо", "хорошее", "подробно", "подробное", "проверка", "проверки", "описание", "задача", "задачи", "проблема", "решение", "работа", "результат"}


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
    if not re.search(r"\w", UNINFORMATIVE.sub("", value.casefold())):
        return False
    words = re.findall(r"[\w]+", UNINFORMATIVE.sub("", value.casefold()), flags=re.UNICODE)
    informative = {word for word in words if len(word) >= 3 and word not in FILLER_WORDS}
    if len(informative) < 2 or len("".join(informative)) < 10:
        return False
    if key == "successTarget" and not (re.search(r"\d", value) or re.search(r"\b(?:не\s+более|не\s+менее|отсутств\w*|ни\s+одн\w*)\b", value.casefold())):
        return False
    return True


def score_task(card: Mapping[str, str]) -> dict:
    breakdown = []
    missing = []
    credited: list[set[str]] = []
    for key, weight, hint in WEIGHTS:
        words = set(re.findall(r"[\w]+", card.get(key, "").casefold(), flags=re.UNICODE))
        content = {word for word in words if len(word) >= 3 and word not in FILLER_WORDS}
        repeated = any(content and len(content & earlier) / len(content | earlier) >= 0.8 for earlier in credited)
        earned = weight if meaningful(card.get(key, ""), key) and not repeated else 0
        if earned:
            credited.append(content)
        breakdown.append({"key": key, "earned": earned, "max": weight})
        if not earned:
            missing.append({"key": key, "hint": hint})
    total = sum(part["earned"] for part in breakdown)
    return {"total": total, "level": get_level(total), "breakdown": breakdown, "missing": missing}
