from app.rating import get_level, score_task


def test_empty_and_full_rating():
    assert score_task({})["total"] == 0
    full = {key: "Подробное описание для проверки" for key in (
        "context", "need", "dataDescription", "dataAccess", "expectedResult", "successMetric",
        "successTarget", "constraints", "users", "interactionFormat")}
    full["contact"] = "demo@example.com"
    rating = score_task(full)
    assert rating["total"] == 100
    assert len(rating["breakdown"]) == 11
    assert rating["missing"] == []


def test_placeholders_and_boundaries():
    assert score_task({"context": "позже", "dataDescription": "данных нет", "contact": "не знаю"})["total"] == 0
    assert [get_level(n) for n in (39, 40, 69, 70, 89, 90)] == [
        "черновик", "рабочая", "рабочая", "готовая", "готовая", "приоритетная"]


def test_each_weight():
    from app.rating import WEIGHTS
    for key, weight, _ in WEIGHTS:
        value = "demo@example.com" if key == "contact" else "Подробное описание для проверки"
        assert score_task({key: value})["total"] == weight
