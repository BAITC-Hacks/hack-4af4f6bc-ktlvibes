import { useEffect, useState, type FormEvent } from "react";
import type { User } from "../../shared/types";
import { deleteProfile, updateProfile } from "./authApi";
import "./users.css";

export function AccountPage({ user, onUpdated, onDeleted }: { user: User; onUpdated: (user: User) => void; onDeleted: () => void }) {
  const [role, setRole] = useState(user.role);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [interests, setInterests] = useState(user.interests);
  const [skills, setSkills] = useState(user.skills);
  const [technologies, setTechnologies] = useState(user.technologies);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setRole(user.role); setName(user.name); setEmail(user.email);
    setInterests(user.interests); setSkills(user.skills); setTechnologies(user.technologies);
  }, [user]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setSuccess("");
    try {
      const updated = await updateProfile(user.id, {
        role, name: name.trim(), email: email.trim(),
        interests: role === "team" ? interests.trim() : "",
        skills: role === "team" ? skills.trim() : "",
        technologies: role === "team" ? technologies.trim() : "",
        ...(password ? { password } : {}),
      });
      setPassword("");
      setSuccess("Профиль обновлён.");
      onUpdated(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить профиль.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm("Удалить ваш аккаунт? Это действие нельзя отменить.")) return;
    setPending(true); setError(""); setSuccess("");
    try {
      await deleteProfile(user.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить аккаунт.");
    } finally {
      setPending(false);
    }
  }

  return <section className="page-stack account-page">
    <div><p className="eyebrow">Аккаунт #{user.id}</p><h1>Мой профиль</h1><p className="muted">Здесь можно изменить ваши данные и пароль.</p></div>
    <section className="detail-card">
      <form className="form-stack users-form" onSubmit={save}>
        <label>Роль
          <select value={role} onChange={(event) => setRole(event.target.value as User["role"])} disabled={pending}>
            <option value="business">Бизнес</option><option value="team">Команда</option>
          </select>
        </label>
        <label>Название<input required value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></label>
        <label>Электронная почта<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} /></label>
        <label>Новый пароль <span className="muted">(оставьте пустым, чтобы не менять)</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} /></label>
        {role === "team" && <div className="users-team-fields">
          <label>Интересы<input value={interests} onChange={(event) => setInterests(event.target.value)} disabled={pending} /></label>
          <label>Навыки<input value={skills} onChange={(event) => setSkills(event.target.value)} disabled={pending} /></label>
          <label>Технологии<input value={technologies} onChange={(event) => setTechnologies(event.target.value)} disabled={pending} /></label>
          <p className="muted">Баллы команды: {user.points}</p>
        </div>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {success && <p className="notice notice-success" role="status">{success}</p>}
        <button className="button-primary" type="submit" disabled={pending || !name.trim()}>{pending ? "Сохраняем…" : "Сохранить"}</button>
      </form>
    </section>
    <section className="detail-card account-danger">
      <h2>Удалить аккаунт</h2>
      <p className="muted">Аккаунт с задачами или откликами удалить нельзя.</p>
      <button className="button-secondary users-delete" type="button" onClick={remove} disabled={pending}>Удалить мой аккаунт</button>
    </section>
  </section>;
}
