import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../shared/api";
import type { RatingLevel, Task } from "../../shared/types";
import { getCatalog } from "./api";

const levels: RatingLevel[] = ["черновик", "рабочая", "готовая", "приоритетная"];

interface CatalogPageProps {
  actorId: number;
}

export function CatalogPage({ actorId }: CatalogPageProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<RatingLevel | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getCatalog({ topic, level })
      .then((result) => {
        if (!cancelled) setTasks(result);
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
  }, [actorId, level, topic]);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Открытый пул задач</p>
          <h1>Найдите задачу для команды</h1>
          <p className="muted">Все опубликованные задачи доступны для просмотра и отклика.</p>
        </div>
      </div>

      <div className="filters" aria-label="Фильтры каталога">
        <label>
          Тема
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Например, образование" />
        </label>
        <label>
          Готовность
          <select value={level} onChange={(event) => setLevel(event.target.value as RatingLevel | "")}>
            <option value="">Любой уровень</option>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {loading && <p role="status">Загружаем задачи…</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <div className="empty-state">По этим фильтрам задач пока нет. Попробуйте изменить фильтры.</div>
      )}

      <div className="task-grid">
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <div className="task-card-meta">
              <span className="tag">{task.topic}</span>
              <span className="score">{task.score ?? 0}<small> / 100</small></span>
            </div>
            <h2><Link to={`/tasks/${task.id}`}>{task.title || "Бизнес-задача"}</Link></h2>
            <p>{task.need || task.initialDescription}</p>
            <div className="task-card-footer">
              <span>{task.rating?.level ?? "требует уточнения"}</span>
              <Link className="text-link" to={`/tasks/${task.id}`}>Посмотреть задачу →</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
