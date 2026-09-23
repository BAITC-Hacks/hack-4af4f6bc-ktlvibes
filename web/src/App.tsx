import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { ActorSwitcher } from "./shared/ActorSwitcher";
import { request } from "./shared/api";
import type { DemoActor, DemoActors } from "./shared/types";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { TaskPage } from "./features/proposals/TaskPage";
import { BusinessWorkspace, TaskEditor } from "./features/business";

const ACTOR_STORAGE_KEY = "ai-sana-demo-actor";

function toActors(data: DemoActors): DemoActor[] {
  return [
    ...data.businesses.map((business) => ({ role: "business" as const, ...business })),
    ...data.teams.map((team) => ({ role: "team" as const, id: team.id, name: team.name })),
  ];
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [actors, setActors] = useState<DemoActor[]>([]);
  const [actorKey, setActorKey] = useState(() => localStorage.getItem(ACTOR_STORAGE_KEY) ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    request<DemoActors>("/api/demo-actors")
      .then((data) => {
        if (cancelled) return;
        const availableActors = toActors(data);
        setActors(availableActors);
        if (availableActors.length === 0) {
          setError("Демо-профили пока не добавлены. Повторите попытку позже.");
        }
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
  }, [reloadKey]);

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
    if (location.pathname.startsWith("/business")) {
      navigate(nextActor.role === "business" ? "/business" : "/tasks");
    }
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
          {actor?.role === "business" && <Link to="/business">Кабинет бизнеса</Link>}
        </nav>
        <ActorSwitcher actors={actors} value={actor} onChange={chooseActor} disabled={loading} />
      </header>

      <main className="main-content">
        {error && (
          <div className="notice notice-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Повторить загрузку
            </button>
          </div>
        )}
        {!actor && loading && <p role="status">Подключаем демо-профили…</p>}
        {actor && (
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<CatalogPage actorId={actor.id} />} />
            <Route path="/tasks/:taskId" element={<TaskPage actorId={actor.id} role={actor.role} />} />
            <Route path="/business" element={actor.role === "business" ? <BusinessWorkspace businessId={actor.id} /> : <Navigate to="/tasks" replace />} />
            <Route path="/business/tasks/new" element={actor.role === "business" ? <BusinessEditorRoute businessId={actor.id} /> : <Navigate to="/tasks" replace />} />
            <Route path="/business/tasks/:taskId/edit" element={actor.role === "business" ? <BusinessEditorRoute businessId={actor.id} /> : <Navigate to="/tasks" replace />} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function BusinessEditorRoute({ businessId }: { businessId: number }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  return <TaskEditor businessId={businessId} taskId={taskId ? Number(taskId) : undefined} onPublished={(id) => navigate(`/tasks/${id}`)} />;
}
