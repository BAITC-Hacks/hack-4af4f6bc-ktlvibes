import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CardFields, Question, QuestionSource, Rating, Task } from "../../shared/types";
import { confirmTask, createDraft, getQuestions, getTask, saveDraft, scorePreview } from "./api";
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

interface TaskEditorProps {
  businessId: number;
  taskId?: number;
  onPublished: (id: number) => void;
  onSavedExit: () => void;
}

export function TaskEditor({ businessId, taskId, onPublished, onSavedExit }: TaskEditorProps) {
  const [id, setId] = useState<number | undefined>(taskId);
  const [status, setStatus] = useState<Task["status"]>("draft");
  const [description, setDescription] = useState("");
  const [card, setCard] = useState<CardFields>(emptyCard);
  const [rating, setRating] = useState<Rating | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionSource, setQuestionSource] = useState<QuestionSource | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setId(taskId); setQuestion(null); setQuestionSource(null); setInterviewStarted(false);
    setAnswer(""); setRating(null); setDirty(false); setError(""); setMessage("");
    if (!taskId) {
      setDescription(""); setCard(emptyCard); setStatus("draft"); setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getTask(taskId, businessId)
      .then(async (task) => {
        if (task.businessId !== businessId) throw new Error("Эта задача принадлежит другому бизнесу.");
        const savedCard = cardFromTask(task);
        const savedRating = task.rating ?? await scorePreview(task.id, savedCard, businessId);
        if (!active) return;
        setDescription(task.initialDescription); setCard(savedCard); setStatus(task.status);
        setRating(savedRating);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачу.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, taskId]);

  const update = (key: keyof CardFields, value: string) => {
    setCard((current) => ({ ...current, [key]: value }));
    setDirty(true); setMessage("");
  };

  const run = async (action: string, work: () => Promise<void>) => {
    setBusy(action); setError(""); setMessage("");
    try { await work(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие."); }
    finally { setBusy(""); }
  };

  const askNext = async (currentId: number, currentCard: CardFields) => {
    const result = await getQuestions(currentId, description, currentCard, businessId);
    setQuestion(result.questions[0] ?? null);
    setQuestionSource(result.source);
    setAnswer("");
    setInterviewStarted(true);
  };

  const saveCard = async (currentId: number, currentCard: CardFields) => {
    const saved = await saveDraft(currentId, currentCard, businessId);
    setCard(cardFromTask(saved.task));
    setRating(saved.rating);
    setDirty(false);
    return saved.rating;
  };

  const makeDraft = () => run("draft", async () => {
    const task = await createDraft(description.trim(), card.topic.trim(), businessId);
    setId(task.id); setStatus("draft"); setDirty(false);
    setRating(await scorePreview(task.id, card, businessId));
    setMessage("Черновик создан и сохранён. Отвечайте на вопросы по одному.");
    await askNext(task.id, card);
  });

  const startInterview = () => id && run("questions", async () => {
    let currentCard = card;
    if (dirty) {
      await saveCard(id, currentCard);
      currentCard = { ...currentCard };
    }
    await askNext(id, currentCard);
  });

  const answerQuestion = () => {
    if (!id || !question || !answer.trim()) return;
    void run("answer", async () => {
      const currentField = question.field;
      const nextCard = { ...card, [currentField]: answer.trim() };
      const nextRating = await saveCard(id, nextCard);
      setQuestion(null);
      setMessage(nextRating.missing.some((item) => item.key === currentField)
        ? "Ответ сохранён. Добавьте конкретики, чтобы получить баллы за этот пункт."
        : "Ответ сохранён. Рейтинг обновлён.");
      await askNext(id, nextCard);
    });
  };

  const refreshRating = () => id && run("rating", async () => {
    if (status === "draft") {
      await saveCard(id, card);
      if (interviewStarted) await askNext(id, card);
      setMessage("Карточка и рейтинг сохранены.");
    } else {
      setRating(await scorePreview(id, card, businessId));
      setMessage("Предварительный рейтинг пересчитан. Подтвердите изменения для публикации.");
    }
  });

  const saveAndExit = () => run("exit", async () => {
    if (id) {
      const currentCard = question && answer.trim() ? { ...card, [question.field]: answer.trim() } : card;
      await saveCard(id, currentCard);
    }
    else await createDraft(description.trim(), card.topic.trim(), businessId);
    onSavedExit();
  });

  const publish = () => id && run("confirm", async () => {
    const task = await confirmTask(id, card, businessId);
    setStatus("published"); setRating(task.rating); setDirty(false);
    onPublished(task.id);
  });

  if (loading) return <p role="status">Загружаем задачу…</p>;
  return <section className="page-stack business-editor">
    <div className="business-heading business-editor-header">
      <div>
        <Link className="text-link" to="/business">← К моим задачам</Link>
        <p className="eyebrow">Конструктор задачи</p>
        <h1>{id ? "Редактирование задачи" : "Новая задача"}</h1>
        <p className="muted">{status === "published" ? "Изменения попадут в каталог после повторного подтверждения." : "Отвечайте по одному вопросу, наблюдайте за рейтингом и возвращайтесь к черновику в любое время."}</p>
      </div>
      {status === "draft" && <button className="business-button" type="button" onClick={saveAndExit} disabled={Boolean(busy) || (!id && !description.trim())}>
        {busy === "exit" ? "Сохраняем…" : "Сохранить и выйти"}
      </button>}
    </div>

    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {message && <p className="notice business-success" role="status">{message}</p>}

    <div className="detail-card business-section">
      <div className="business-step-heading"><span className="business-step-number">1</span><div><h2>Исходная идея</h2><p className="muted">Нескольких предложений достаточно для начала.</p></div></div>
      <label>Краткое описание задачи<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(id)} rows={3} required /></label>
      {!id && <label>Тема<input value={card.topic} onChange={(event) => update("topic", event.target.value)} placeholder="Например, образование" /></label>}
      {!id && <button className="business-button" type="button" onClick={makeDraft} disabled={Boolean(busy) || !description.trim()}>{busy === "draft" ? "Создаём…" : "Создать черновик и начать"}</button>}
    </div>

    {id && <>
      <div className="business-interview-grid">
        <div className="detail-card business-section business-question-panel">
          <div className="business-step-heading"><span className="business-step-number">2</span><div><h2>Уточняем задачу</h2><p className="muted">Один ответ — обновление карточки и рейтинга — следующий вопрос.</p></div></div>
          {status === "draft" ? <>
            {!interviewStarted && <div className="business-question-empty"><p>Продолжите с того места, где остановились. Уже сохранённые ответы учтены.</p><button type="button" onClick={startInterview} disabled={Boolean(busy)}>{busy === "questions" ? "Подбираем вопрос…" : "Продолжить вопросы"}</button></div>}
            {interviewStarted && question && <form className="business-question" onSubmit={(event) => { event.preventDefault(); answerQuestion(); }}>
              <span className="business-question-kicker">Следующий вопрос · {questionSource === "llm" ? "AI" : "подсказка"}</span>
              <h3>{question.text}</h3>
              <p className="muted">Этот ответ дополнит поле «{labelFor(question.field)}».</p>
              <label htmlFor="business-answer">Ваш ответ</label>
              <textarea id="business-answer" rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Расскажите своими словами…" required />
              <button className="business-button" type="submit" disabled={Boolean(busy) || !answer.trim()}>{busy === "answer" ? "Сохраняем и подбираем вопрос…" : "Ответить и продолжить →"}</button>
            </form>}
            {interviewStarted && !question && <div className="business-question-empty">
              <h3>{rating?.missing.length === 0 ? "Задача раскрыта" : "Продолжим уточнение?"}</h3>
              <p className="muted">{rating?.missing.length === 0 ? "Все пункты рейтинга заполнены. Проверьте карточку и опубликуйте её, когда будете готовы." : "Ответы сохранены. Следующий вопрос можно получить сейчас или после возвращения к черновику."}</p>
              {rating?.missing.length !== 0 && <button type="button" onClick={startInterview} disabled={Boolean(busy)}>{busy === "questions" ? "Подбираем вопрос…" : "Получить следующий вопрос"}</button>}
            </div>}
          </> : <p className="muted">Карточка уже опубликована. Исправьте нужные поля ниже и подтвердите обновление.</p>}
        </div>

        <div className="detail-card business-section business-score-panel">
          <div className="business-step-heading"><span className="business-step-number">3</span><div><h2>Готовность задачи</h2><p className="muted">Оценка обновляется после каждого сохранённого ответа.</p></div></div>
          <div className="business-score-main"><strong>{rating?.total ?? 0}</strong><span>/ 100</span><span className="business-level">{rating?.level ?? "черновик"}</span></div>
          <div className="business-score-track" role="progressbar" aria-label="Рейтинг готовности задачи" aria-valuenow={rating?.total ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${rating?.total ?? 0}%` }} /></div>
          <p className="muted">{status === "draft" ? "Предварительный рейтинг сохранённого черновика" : "Рейтинг опубликованной карточки"}{dirty ? " · есть несохранённые изменения" : ""}</p>
          {rating && <div className="business-score-breakdown"><h3>Что уже учтено</h3><ul>{rating.breakdown.map((item) => <li key={item.key}><span>{labelFor(item.key)}</span><strong>{item.earned} / {item.max}</strong></li>)}</ul></div>}
          {rating && rating.missing.length > 0 && <div className="business-score-next"><h3>Что повысит рейтинг</h3><ul>{rating.missing.slice(0, 3).map((item) => <li key={item.key}>{item.hint}</li>)}</ul></div>}
        </div>
      </div>

      <details className="detail-card business-card-details">
        <summary>Посмотреть и изменить всю карточку <span>{dirty ? "Есть несохранённые изменения" : "Все поля доступны для правки"}</span></summary>
        <div className="business-fields">{fields.map(({ key, label }) => <label key={key}>{label}{key === "topic" || key === "title" || key === "contact" ? <input value={card[key]} onChange={(event) => update(key, event.target.value)} /> : <textarea rows={3} value={card[key]} onChange={(event) => update(key, event.target.value)} />}</label>)}</div>
        <button type="button" onClick={refreshRating} disabled={Boolean(busy)}>{busy === "rating" ? "Обновляем…" : status === "draft" ? "Сохранить карточку и обновить рейтинг" : "Проверить рейтинг изменений"}</button>
      </details>

      <div className="detail-card business-section business-publish-panel">
        <div><h2>Готовы показать задачу командам?</h2><p className="muted">Проверьте карточку вручную. Подтверждение {status === "published" ? "обновит опубликованную задачу" : "опубликует задачу в общем каталоге"}. К черновику можно вернуться позже.</p></div>
        <button className="business-button" type="button" onClick={publish} disabled={Boolean(busy) || !card.title.trim() || !card.topic.trim()}>{busy === "confirm" ? "Сохраняем…" : status === "published" ? "Подтвердить обновление" : "Подтвердить и опубликовать"}</button>
      </div>
    </>}
  </section>;
}
