import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../shared/api";
import type { PublishedTask, Task } from "../../shared/types";
import { getTask } from "../catalog/api";
import { BusinessProposals } from "./BusinessProposals";
import { TeamProposals } from "./TeamProposals";

interface TaskPageProps {
  actorId: number;
  role: "business" | "team";
}

const ratingLabels: Record<string, string> = {
  context: "Контекст",
  need: "Потребность",
  dataDescription: "Данные",
  dataAccess: "Доступ к данным",
  expectedResult: "Результат",
  successMetric: "Метрика успеха",
  successTarget: "Цель",
  constraints: "Ограничения",
  users: "Пользователи",
  contact: "Контакт",
  interactionFormat: "Формат связи",
};

export function TaskPage({ actorId, role }: TaskPageProps) {
  const { taskId: rawTaskId } = useParams();
  const taskId = Number(rawTaskId);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setTask(null);
    setError("");
    setLoading(true);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
      setError("Некорректный номер задачи.");
      setLoading(false);
      return;
    }

    getTask(taskId)
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
  }, [actorId, role, taskId]);

  if (loading) return <p role="status">Загружаем задачу…</p>;
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!task) return <p className="empty-state">Задача не найдена.</p>;

  const isOwner = role === "business" && task.businessId === actorId;

  return (
    <section className="page-stack">
      <Link className="text-link" to="/tasks">← К каталогу</Link>
      <article className="detail-card">
        <div className="task-card-meta">
          <span className="tag">{task.topic || "Тема не указана"}</span>
          <span className="score">{task.score === null ? "—" : task.score}<small> / 100</small></span>
        </div>
        <h1>{task.title || task.initialDescription}</h1>
        <p className="muted">
          {task.status === "published" ? "Уровень готовности: " + task.rating.level : "Черновик — ещё не опубликован"}
        </p>
        {isOwner && (
          <p><Link className="text-link" to={"/business/tasks/" + task.id + "/edit"}>Редактировать карточку →</Link></p>
        )}

        <dl className="task-fields">
          <div><dt>Контекст</dt><dd>{task.context || "Не указан"}</dd></div>
          <div><dt>Потребность</dt><dd>{task.need || task.initialDescription}</dd></div>
          <div><dt>Пользователи</dt><dd>{task.users || "Не указаны"}</dd></div>
          <div><dt>Данные и материалы</dt><dd>{task.dataDescription || "Не указаны"}</dd></div>
          <div><dt>Доступ к данным</dt><dd>{task.dataAccess || "Не указан"}</dd></div>
          <div><dt>Ограничения</dt><dd>{task.constraints || "Не указаны"}</dd></div>
          <div><dt>Ожидаемый результат</dt><dd>{task.expectedResult || "Не указан"}</dd></div>
          <div><dt>Критерий успеха</dt><dd>{task.successMetric || "Не указан"}</dd></div>
          <div><dt>Целевое значение</dt><dd>{task.successTarget || "Не указано"}</dd></div>
          <div><dt>Контакт</dt><dd>{task.contact || "Не указан"}</dd></div>
          <div><dt>Формат взаимодействия</dt><dd>{task.interactionFormat || "Не указан"}</dd></div>
        </dl>
      </article>

      {task.status === "published" ? (
        <>
          <RatingDetails task={task} />
          {role === "team" && <TeamProposals key={"team:" + actorId + ":" + taskId} actorId={actorId} taskId={taskId} />}
          {isOwner && <BusinessProposals key={"business:" + actorId + ":" + taskId} actorId={actorId} taskId={taskId} />}
        </>
      ) : (
        <div className="empty-state">После публикации команды смогут отправлять предложения по этой задаче.</div>
      )}
    </section>
  );
}

function RatingDetails({ task }: { task: PublishedTask }) {
  return (
    <section className="detail-card">
      <h2>Как рассчитан рейтинг</h2>
      <div className="rating-grid">
        {task.rating.breakdown.map((item) => (
          <div key={item.key} className="rating-item">
            <span>{ratingLabels[item.key] || item.key}</span>
            <strong>{item.earned} / {item.max}</strong>
          </div>
        ))}
      </div>
      {task.rating.missing.length > 0 && (
        <>
          <h3>Что можно уточнить</h3>
          <ul className="hint-list">
            {task.rating.missing.map((item) => <li key={item.key}>{item.hint}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}
