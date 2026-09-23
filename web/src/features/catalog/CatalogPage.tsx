import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../shared/api";
import type { PublishedTask, RatingLevel } from "../../shared/types";
import { getCatalog } from "./api";

const levels: RatingLevel[] = ["черновик", "рабочая", "готовая", "приоритетная"];

interface CatalogPageProps {
  actorId: number;
}

export function CatalogPage({ actorId }: CatalogPageProps) {
  const [tasks, setTasks] = useState<PublishedTask[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<RatingLevel | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setTasks([]);

    const allTasks = getCatalog();
    const filteredTasks = topic || level ? getCatalog({ topic, level }) : allTasks;
    Promise.all([allTasks, filteredTasks])
      .then(([all, filtered]) => {
        if (cancelled) return;
        setTopics([...new Set(all.map((task) => task.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")));
        setTasks(filtered);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить каталог.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, level, topic, reloadKey]);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Открытый пул задач</p>
          <h1>Каталог бизнес-задач</h1>
          <p className="muted">Все опубликованные задачи доступны командам. Порядок зависит от рейтинга готовности.</p>
        </div>
      </div>

      <div className="filters" aria-label="Фильтры каталога">
        <label>
          Тема
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">Все темы</option>
            {topics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Готовность
          <select value={level} onChange={(event) => setLevel(event.target.value as RatingLevel | "")}>
            <option value="">Любой уровень</option>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {(topic || level) && (
          <button type="button" onClick={() => { setTopic(""); setLevel(""); }}>
            Сбросить фильтры
          </button>
        )}
      </div>

      {loading && <p role="status">Загружаем задачи…</p>}
      {error && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Повторить загрузку</button>
        </div>
      )}
      {!loading && !error && tasks.length === 0 && (
        <div className="empty-state">
          {topic || level ? "По этим фильтрам задач нет. Попробуйте изменить выбор." : "Опубликованных задач пока нет."}
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <p className="muted catalog-count">Задач: {tasks.length}. Сначала показаны задачи с более высоким рейтингом.</p>
      )}

      <div className="task-grid">
        {!loading && !error && tasks.map((task, index) => (
          <article className="task-card" key={task.id}>
            <div className="task-card-meta">
              <span className="tag">{task.topic}</span>
              <span className="score">{task.score}<small> / 100</small></span>
            </div>
            <h2><Link to={`/tasks/${task.id}`}>{task.title || "Бизнес-задача"}</Link></h2>
            <p>{task.need || task.initialDescription}</p>
            <div className="task-card-footer">
              <span>№ {index + 1} · {task.rating.level}</span>
              <Link className="text-link" to={`/tasks/${task.id}`}>Посмотреть задачу →</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
