import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ActorSwitcher } from "./shared/ActorSwitcher";
import { request } from "./shared/api";
import type { DemoActor, DemoActors } from "./shared/types";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { TaskPage } from "./features/proposals/TaskPage";

const ACTOR_STORAGE_KEY = "ai-sana-demo-actor";

function toActors(data: DemoActors): DemoActor[] {
  return [
    ...data.businesses.map((business) => ({ role: "business" as const, ...business })),
    ...data.teams.map((team) => ({ role: "team" as const, id: team.id, name: team.name })),
  ];
}

export default function App() {
  const [actors, setActors] = useState<DemoActor[]>([]);
  const [actorKey, setActorKey] = useState(() => localStorage.getItem(ACTOR_STORAGE_KEY) ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    request<DemoActors>("/api/demo-actors")
      .then((data) => {
        if (!cancelled) setActors(toActors(data));
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить демо-профили. Проверьте, запущен ли backend.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const actor = useMemo(
    () => actors.find((item) => `${item.role}:${item.id}` === actorKey) ?? actors[0] ?? null,
    [actorKey, actors],
  );

  useEffect(() => {
    if (actor) {
      const nextKey = `${actor.role}:${actor.id}`;
      setActorKey(nextKey);
      localStorage.setItem(ACTOR_STORAGE_KEY, nextKey);
    }
  }, [actor]);

  const chooseActor = (nextActor: DemoActor) => {
    const nextKey = `${nextActor.role}:${nextActor.id}`;
    setActorKey(nextKey);
    localStorage.setItem(ACTOR_STORAGE_KEY, nextKey);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/tasks" aria-label="AI Sana — на главную">
          <span className="brand-mark">S</span>
          <span>AI Sana</span>
        </Link>
        <nav className="main-nav" aria-label="Главная навигация">
          <Link to="/tasks">Каталог</Link>
          <Link to="/business">Кабинет бизнеса</Link>
        </nav>
        <ActorSwitcher actors={actors} value={actor} onChange={chooseActor} disabled={loading} />
      </header>

      <main className="main-content">
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {!actor && loading && <p role="status">Подключаем демо-профили…</p>}
        {actor && (
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<CatalogPage actorId={actor.id} />} />
            <Route path="/tasks/:taskId" element={<TaskPage actorId={actor.id} role={actor.role} />} />
            <Route path="/business/*" element={<BusinessPlaceholder role={actor.role} />} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function BusinessPlaceholder({ role }: { role: DemoActor["role"] }) {
  return (
    <section className="empty-state">
      <p className="eyebrow">Кабинет бизнеса</p>
      <h1>Раздел конструктора подключит фронт 1</h1>
      <p>Сейчас выбран профиль: {role === "business" ? "бизнес" : "команда"}.</p>
      <Link className="text-link" to="/tasks">Открыть каталог задач →</Link>
    </section>
  );
}
