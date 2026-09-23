from app.rating import get_level, score_task


def test_empty_and_full_rating():
    assert score_task({})["total"] == 0
    full = {
        "context": "Сейчас менеджеры вручную распределяют обращения клиентов.",
        "need": "Хотим быстрее распределять заявки между сотрудниками.",
        "dataDescription": "Есть обезличенная таблица с примерами заявок.",
        "dataAccess": "Передадим таблицу по ссылке после первой встречи.",
        "expectedResult": "Прототип предлагает категорию для новой заявки.",
        "successMetric": "Измерим время распределения каждой заявки.",
        "successTarget": "Среднее время сократится до 5 минут.",
        "constraints": "Нельзя использовать настоящие имена клиентов.",
        "users": "Менеджеры службы поддержки клиентов.",
        "interactionFormat": "Еженедельный созвон с командой и письменные комментарии.",
        "contact": "demo@example.com",
    }
    rating = score_task(full)
    assert rating["total"] == 100
    assert len(rating["breakdown"]) == 11
    assert rating["missing"] == []


def test_placeholders_and_boundaries():
    assert score_task({"context": "позже", "dataDescription": "данных нет", "contact": "не знаю"})["total"] == 0
    assert score_task({"context": "Пока не знаю", "need": "Подробное описание для проверки", "dataDescription": "Нет материалов", "expectedResult": "Хорошее решение задачи"})["total"] == 0
    assert score_task({"context": "Не знаю, уточню позже", "dataDescription": "Нет материалов, примеров нет"})["total"] == 0
    assert [get_level(n) for n in (39, 40, 69, 70, 89, 90)] == [
        "черновик", "рабочая", "рабочая", "готовая", "готовая", "приоритетная"]


def test_each_weight():
    from app.rating import WEIGHTS
    examples = {
        "context": "Сейчас менеджеры вручную разбирают заявки клиентов.",
        "need": "Хотим сократить время обработки обращений.",
        "dataDescription": "Есть таблица с примерами обращений.",
        "dataAccess": "Передадим таблицу команде по ссылке.",
        "expectedResult": "Прототип распределяет заявки по категориям.",
        "successMetric": "Измерим время распределения заявок.",
        "successTarget": "Время обработки меньше 5 минут.",
        "constraints": "Нельзя показывать личные данные клиентов.",
        "users": "Менеджеры службы поддержки клиентов.",
        "interactionFormat": "Созвон с командой каждую неделю.",
        "contact": "demo@example.com",
    }
    for key, weight, _ in WEIGHTS:
        assert score_task({key: examples[key]})["total"] == weight


def test_repeated_answer_does_not_raise_rating():
    context = "Сейчас менеджеры вручную разбирают заявки клиентов."
    assert score_task({"context": context, "need": context})["total"] == 10
    assert score_task({"context": context, "need": "Хотим сократить время обработки обращений."})["total"] == 20
