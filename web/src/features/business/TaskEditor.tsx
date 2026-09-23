import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CardFields, QuestionsResponse, Rating, Task } from "../../shared/types";
import { confirmTask, createDraft, getQuestions, getTask, scorePreview } from "./api";
import "./business.css";

const fields: { key: keyof CardFields; label: string }[] = [
  { key: "topic", label: "Тема" }, { key: "title", label: "Название" },
  { key: "context", label: "Контекст" }, { key: "need", label: "Потребность" },
  { key: "users", label: "Пользователи" }, { key: "dataDescription", label: "Описание данных" },
  { key: "dataAccess", label: "Доступ к данным" }, { key: "constraints", label: "Ограничения" },
  { key: "expectedResult", label: "Ожидаемый результат" }, { key: "successMetric", label: "Метрика успеха" },
  { key: "successTarget", label: "Целевое значение" }, { key: "contact", label: "Контакт" },
  { key: "interactionFormat", label: "Формат взаимодействия" },
];
const emptyCard = Object.fromEntries(fields.map(({ key }) => [key, ""])) as unknown as CardFields;
const labelFor = (key: string) => fields.find((field) => field.key === key)?.label ?? key;
const cardFromTask = (task: Task): CardFields => Object.fromEntries(fields.map(({ key }) => [key, task[key]])) as unknown as CardFields;

export function TaskEditor({ businessId, taskId, onPublished }: { businessId: number; taskId?: number; onPublished: (id: number) => void }) {
  const [id, setId] = useState<number | undefined>(taskId);
  const [status, setStatus] = useState<Task["status"]>("draft");
  const [description, setDescription] = useState("");
  const [card, setCard] = useState<CardFields>(emptyCard);
  const [questions, setQuestions] = useState<QuestionsResponse | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [savedRating, setSavedRating] = useState<Rating | null>(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setId(taskId); setQuestions(null); setRating(null); setSavedRating(null); setError(""); setMessage("");
    if (!taskId) { setDescription(""); setCard(emptyCard); setStatus("draft"); setLoading(false); return; }
    let active = true;
    setLoading(true);
    getTask(taskId, businessId).then((task) => {
      if (!active) return;
      if (task.businessId !== businessId) throw new Error("Эта задача принадлежит другому бизнесу.");
      setDescription(task.initialDescription); setCard(cardFromTask(task)); setStatus(task.status);
      setSavedRating(task.rating);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачу."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, taskId]);

  const update = (key: keyof CardFields, value: string) => {
    setCard((current) => ({ ...current, [key]: value }));
    setRating(null); setMessage("");
  };
  const run = async (action: string, work: () => Promise<void>) => {
    setBusy(action); setError(""); setMessage("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие."); }
    finally { setBusy(""); }
  };
  const makeDraft = () => run("draft", async () => {
    const task = await createDraft(description.trim(), card.topic.trim(), businessId);
    setId(task.id); setStatus("draft"); setMessage("Черновик создан. Теперь можно получить вопросы и заполнить карточку.");
  });
  const ask = () => id && run("questions", async () => {
    const result = await getQuestions(id, description, card, businessId);
    setQuestions(result);
  });
  const preview = () => id && run("preview", async () => {
    setRating(await scorePreview(id, card, businessId));
  });
  const publish = () => id && run("confirm", async () => {
    const task = await confirmTask(id, card, businessId);
    setStatus("published"); setSavedRating(task.rating); setRating(null);
    onPublished(task.id);
  });

  if (loading) return <p role="status">Загружаем задачу…</p>;
  return <section className="page-stack business-editor">
    <div><Link className="text-link" to="/business">← К моим задачам</Link><p className="eyebrow">Конструктор задачи</p><h1>{id ? "Редактирование задачи" : "Новая задача"}</h1><p className="muted">{status === "published" ? "Изменения попадут в каталог после повторного подтверждения." : "Опишите идею, ответьте на вопросы и проверьте готовность карточки."}</p></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {message && <p className="notice business-success" role="status">{message}</p>}
    <div className="detail-card business-section">
      <h2>1. Исходная идея</h2>
      <label>Краткое описание задачи<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(id)} rows={4} required /></label>
      {!id && <label>Тема<input value={card.topic} onChange={(event) => update("topic", event.target.value)} placeholder="Например, образование" /></label>}
      {!id && <button className="business-button" onClick={makeDraft} disabled={Boolean(busy) || !description.trim()}>{busy === "draft" ? "Создаём…" : "Создать черновик"}</button>}
    </div>
    {id && <>
      <div className="detail-card business-section"><div className="business-heading"><div><h2>2. Уточняющие вопросы</h2><p className="muted">Ответы сразу заполняют соответствующие поля карточки.</p></div><button onClick={ask} disabled={Boolean(busy)}>{busy === "questions" ? "Загружаем…" : "Получить вопросы"}</button></div>
        {questions && <><p className="muted">Источник вопросов: {questions.source === "llm" ? "AI" : "резервный набор"}</p>{questions.questions.map((question, index) => <label key={`${question.field}-${index}`}>{index + 1}. {question.text}<textarea rows={3} value={card[question.field]} onChange={(event) => update(question.field, event.target.value)} /></label>)}</>}
      </div>
      <div className="detail-card business-section"><h2>3. Карточка задачи</h2><p className="muted">Все поля можно изменить перед публикацией.</p><div className="business-fields">{fields.map(({ key, label }) => <label key={key}>{label}{key === "topic" || key === "title" || key === "contact" ? <input value={card[key]} onChange={(event) => update(key, event.target.value)} /> : <textarea rows={3} value={card[key]} onChange={(event) => update(key, event.target.value)} />}</label>)}</div></div>
      <div className="detail-card business-section"><div className="business-heading"><div><h2>4. Рейтинг</h2><p className="muted">Предварительная оценка текущей формы рассчитывается сервером.</p></div><button onClick={preview} disabled={Boolean(busy)}>{busy === "preview" ? "Считаем…" : "Проверить рейтинг"}</button></div>
        {rating && <RatingDetails rating={rating} title="Предварительный рейтинг" />}
        {savedRating && <RatingDetails rating={savedRating} title="Сохранённый рейтинг" />}
      </div>
      <div className="detail-card business-section"><h2>5. Подтверждение</h2><p className="muted">Проверьте сведения вручную. Подтверждение {status === "published" ? "обновит опубликованную задачу" : "опубликует задачу"} и сохранит рейтинг.</p><button className="business-button" onClick={publish} disabled={Boolean(busy) || !card.title.trim() || !card.topic.trim()}>{busy === "confirm" ? "Сохраняем…" : status === "published" ? "Подтвердить обновление" : "Подтвердить и опубликовать"}</button></div>
    </>}
  </section>;
}

function RatingDetails({ rating, title }: { rating: Rating; title: string }) {
  return <div className="business-rating"><h3>{title}: {rating.total} / 100 · {rating.level}</h3><ul>{rating.breakdown.map((item) => <li key={item.key}><span>{labelFor(item.key)}</span><strong>{item.earned} / {item.max}</strong></li>)}</ul>{rating.missing.length > 0 && <div><h4>Что улучшить</h4><ul>{rating.missing.map((item) => <li key={item.key}>{labelFor(item.key)}: {item.hint}</li>)}</ul></div>}</div>;
}
