import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { User } from "./shared/types";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { TaskPage } from "./features/proposals/TaskPage";
import { BusinessWorkspace, TaskEditor } from "./features/business";
import { AccountPage } from "./features/users/AccountPage";
import { AuthPage } from "./features/users/AuthPage";
import { getCurrentUser, logout } from "./features/users/authApi";

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((current) => { if (active) setUser(current); })
      .catch((cause: unknown) => {
        if (active && !(cause instanceof Error && "status" in cause && cause.status === 401)) {
          setError("Не удалось проверить вход. Обновите страницу.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const expired = () => { setUser(null); navigate("/login"); };
    window.addEventListener("aisana-auth-expired", expired);
    return () => window.removeEventListener("aisana-auth-expired", expired);
  }, [navigate]);

  function authenticated(next: User) {
    setUser(next);
    setError("");
  }

  async function signOut() {
    try {
      await logout();
      setUser(null);
      navigate("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выйти. Повторите попытку.");
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to={user ? "/tasks" : "/login"} aria-label="AI Sana — на главную">
        <span className="brand-mark">S</span><span>AI Sana</span>
      </Link>
      {user && <>
        <nav className="main-nav" aria-label="Главная навигация">
          <Link to="/tasks">Каталог</Link>
          {user.role === "business" && <Link to="/business">Кабинет бизнеса</Link>}
          <Link to="/account">Мой профиль</Link>
        </nav>
        <div className="session-controls"><span>{user.name}</span><button className="button-secondary" type="button" onClick={signOut}>Выйти</button></div>
      </>}
    </header>
    <main className="main-content">
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading ? <p role="status">Проверяем вход…</p> : <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === "business" ? "/business" : "/tasks"} replace /> : <AuthPage key="login" mode="login" onAuthenticated={authenticated} />} />
        <Route path="/register" element={user ? <Navigate to={user.role === "business" ? "/business" : "/tasks"} replace /> : <AuthPage key="register" mode="register" onAuthenticated={authenticated} />} />
        <Route path="/" element={<Navigate to={user ? "/tasks" : "/login"} replace />} />
        <Route path="/account" element={user ? <AccountPage user={user} onUpdated={setUser} onDeleted={() => { setUser(null); navigate("/login"); }} /> : <Navigate to="/login" replace />} />
        <Route path="/tasks" element={user ? <CatalogPage actorId={user.id} /> : <Navigate to="/login" replace />} />
        <Route path="/tasks/:taskId" element={user ? <TaskPage actorId={user.id} role={user.role} /> : <Navigate to="/login" replace />} />
        <Route path="/business" element={user?.role === "business" ? <BusinessWorkspace businessId={user.id} /> : <Navigate to={user ? "/tasks" : "/login"} replace />} />
        <Route path="/business/tasks/new" element={user?.role === "business" ? <BusinessEditorRoute businessId={user.id} /> : <Navigate to={user ? "/tasks" : "/login"} replace />} />
        <Route path="/business/tasks/:taskId/edit" element={user?.role === "business" ? <BusinessEditorRoute businessId={user.id} /> : <Navigate to={user ? "/tasks" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={user ? "/tasks" : "/login"} replace />} />
      </Routes>}
    </main>
  </div>;
}

function BusinessEditorRoute({ businessId }: { businessId: number }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  return <TaskEditor businessId={businessId} taskId={taskId ? Number(taskId) : undefined} onPublished={(id) => navigate(`/tasks/${id}`)} />;
}
