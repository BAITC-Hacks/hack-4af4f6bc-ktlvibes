import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Task } from "../../shared/types";
import { getMyTasks } from "./api";
import "./business.css";

export function BusinessWorkspace({ businessId }: { businessId: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getMyTasks().then((items) => {
      if (active) setTasks(items);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачи.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [businessId]);

  return <section className="page-stack">
    <div className="business-heading">
      <div><p className="eyebrow">Кабинет бизнеса</p><h1>Ваши задачи</h1><p className="muted">Черновики и опубликованные задачи в одном месте.</p></div>
      <Link className="business-button" to="/business/tasks/new">Создать задачу</Link>
    </div>
    {loading && <p role="status">Загружаем задачи…</p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {!loading && !error && tasks.length === 0 && <div className="empty-state">У вас пока нет задач. Создайте первый черновик.</div>}
    <div className="task-grid">
      {tasks.map((task) => <article className="task-card" key={task.id}>
        <div className="task-card-meta"><span className="tag">{task.status === "draft" ? "Черновик" : "Опубликована"}</span><span>{task.topic || "Без темы"}</span></div>
        <h2>{task.title || task.initialDescription.slice(0, 70)}</h2>
        <p>{task.need || task.initialDescription}</p>
        <div className="task-card-footer"><span>{task.score === null ? "Без рейтинга" : `${task.score} / 100`}</span><div className="business-actions"><Link className="text-link" to={`/business/tasks/${task.id}/edit`}>Редактировать</Link>{task.status === "published" && <Link className="text-link" to={`/tasks/${task.id}`}>Открыть</Link>}</div></div>
      </article>)}
    </div>
  </section>;
}
