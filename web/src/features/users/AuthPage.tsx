import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { User } from "../../shared/types";
import { login, register, type RegisterInput } from "./authApi";
import "./users.css";

const emptyForm: RegisterInput = {
  role: "business", name: "", email: "", password: "",
  interests: "", skills: "", technologies: "",
};

export function AuthPage({ mode, onAuthenticated }: { mode: "login" | "register"; onAuthenticated: (user: User) => void }) {
  const [form, setForm] = useState<RegisterInput>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (mode === "register") {
        await register({
          ...form, name: form.name.trim(), email: form.email.trim(),
          interests: form.role === "team" ? form.interests.trim() : "",
          skills: form.role === "team" ? form.skills.trim() : "",
          technologies: form.role === "team" ? form.technologies.trim() : "",
        });
      }
      onAuthenticated(await login(form.email, form.password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти. Повторите попытку.");
    } finally {
      setPending(false);
    }
  }

  return <section className="detail-card auth-card">
    <p className="eyebrow">AI Sana</p>
    <h1>{mode === "login" ? "Войти" : "Создать аккаунт"}</h1>
    <p className="muted">{mode === "login" ? "Войдите в свой аккаунт, чтобы работать с задачами и предложениями." : "Выберите роль. Бизнес публикует задачи, команда отправляет предложения."}</p>
    <form className="form-stack users-form" onSubmit={submit}>
      {mode === "register" && <>
        <label>Роль
          <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as User["role"] }))} disabled={pending}>
            <option value="business">Бизнес</option><option value="team">Команда</option>
          </select>
        </label>
        <label>Название
          <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} disabled={pending} />
        </label>
      </>}
      <label>Электронная почта
        <input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} disabled={pending} />
      </label>
      <label>Пароль
        <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} maxLength={128} required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} disabled={pending} />
      </label>
      {mode === "register" && form.role === "team" && <div className="users-team-fields">
        <label>Интересы<input value={form.interests} onChange={(event) => setForm((current) => ({ ...current, interests: event.target.value }))} disabled={pending} /></label>
        <label>Навыки<input value={form.skills} onChange={(event) => setForm((current) => ({ ...current, skills: event.target.value }))} disabled={pending} /></label>
        <label>Технологии<input value={form.technologies} onChange={(event) => setForm((current) => ({ ...current, technologies: event.target.value }))} disabled={pending} /></label>
      </div>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="button-primary" type="submit" disabled={pending}>{pending ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}</button>
    </form>
    <p className="muted">{mode === "login" ? <>Нет аккаунта? <Link className="text-link" to="/register">Зарегистрироваться</Link></> : <>Уже есть аккаунт? <Link className="text-link" to="/login">Войти</Link></>}</p>
  </section>;
}
