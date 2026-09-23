import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../shared/api";
import type { Task } from "../../shared/types";
import { getTask } from "../catalog/api";

interface TaskPageProps {
  actorId: number;
  role: "business" | "team";
}

export function TaskPage({ actorId, role }: TaskPageProps) {
  const { taskId: rawTaskId } = useParams();
  const taskId = Number(rawTaskId);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getTask(taskId, actorId)
      .then((result) => {
        if (!cancelled) setTask(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить задачу.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, taskId]);

  if (loading) return <p role="status">Загружаем задачу…</p>;
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!task) return <p className="empty-state">Задача не найдена.</p>;

  return (
    <section className="page-stack">
      <Link className="text-link" to="/tasks">← К каталогу</Link>
      <article className="detail-card">
        <div className="task-card-meta">
          <span className="tag">{task.topic}</span>
          <span className="score">{task.score ?? 0}<small> / 100</small></span>
        </div>
        <h1>{task.title || "Бизнес-задача"}</h1>
        <p className="muted">Уровень готовности: {task.rating?.level ?? "черновик"}</p>
        <dl className="task-fields">
          <div><dt>Контекст</dt><dd>{task.context || task.initialDescription}</dd></div>
          <div><dt>Потребность</dt><dd>{task.need || "Пока не указана"}</dd></div>
          <div><dt>Пользователи</dt><dd>{task.users || "Пока не указаны"}</dd></div>
          <div><dt>Данные и материалы</dt><dd>{task.dataDescription || "Пока не указаны"}</dd></div>
          <div><dt>Ограничения</dt><dd>{task.constraints || "Пока не указаны"}</dd></div>
          <div><dt>Ожидаемый результат</dt><dd>{task.expectedResult || "Пока не указан"}</dd></div>
          <div><dt>Критерии успеха</dt><dd>{task.successMetric || "Пока не указаны"} {task.successTarget}</dd></div>
        </dl>
      </article>

      <section className="detail-card">
        <h2>{role === "team" ? "Предложение команды" : "Отклики команд"}</h2>
        <p className="muted">
          {role === "team"
            ? "Здесь команда отправит идею, план, срок и ссылку на прототип."
            : "Здесь бизнес сравнит предложения и вручную выберет команды."}
        </p>
        <p className="muted">Следующий шаг: подключить форму отклика, статусы предложений и подтверждение прогресса.</p>
      </section>
    </section>
  );
}
