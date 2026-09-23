import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../shared/api";
import type { Proposal, ProposalStatus } from "../../shared/types";
import { createProposal, getMyProposals, getTeams, type CreateProposalInput } from "./api";

interface TeamProposalsProps {
  actorId: number;
  taskId: number;
}

const emptyForm: CreateProposalInput = {
  idea: "",
  plan: "",
  duration: "",
  prototypeUrl: "",
};

const statusLabels: Record<ProposalStatus, string> = {
  submitted: "На рассмотрении",
  selected: "Выбрано бизнесом",
  rejected: "Отклонено",
};

export function TeamProposals({ actorId, taskId }: TeamProposalsProps) {
  const [form, setForm] = useState<CreateProposalInput>(emptyForm);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setProposals([]);

    Promise.all([getMyProposals(taskId, actorId), getTeams()])
      .then(([savedProposals, teams]) => {
        if (cancelled) return;
        setProposals(savedProposals);
        setPoints(teams.find((team) => team.id === actorId)?.points ?? null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(cause instanceof ApiError ? cause.message : "Не удалось загрузить отклики команды.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, taskId, reloadKey]);

  function setField(field: keyof CreateProposalInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setActionError("");
    setSuccess("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setSuccess("");

    const input = {
      idea: form.idea.trim(),
      plan: form.plan.trim(),
      duration: form.duration.trim(),
      prototypeUrl: form.prototypeUrl.trim(),
    };
    if (Object.values(input).some((value) => !value)) {
      setActionError("Заполните идею, план, срок и ссылку на прототип.");
      return;
    }
    try {
      const url = new URL(input.prototypeUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid protocol");
    } catch {
      setActionError("Укажите HTTP(S)-ссылку на прототип.");
      return;
    }

    setPending(true);
    try {
      const saved = await createProposal(taskId, actorId, input);
      setProposals((current) => [saved, ...current]);
      setForm({ ...emptyForm });
      setSuccess("Предложение отправлено и сохранено.");
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Не удалось отправить предложение.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="detail-card proposal-section">
      <div className="section-heading">
        <div>
          <h2>Предложение команды</h2>
          {points !== null && <p className="muted">Баллы команды: <strong>{points}</strong></p>}
        </div>
        <button type="button" className="button-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
          Обновить отклики
        </button>
      </div>

      {loading && <p role="status">Загружаем отклики…</p>}
      {loadError && <p className="notice notice-error" role="alert">{loadError}</p>}
      {!loading && !loadError && (
        <>
          <form className="form-stack" onSubmit={submit}>
            <label>Идея решения
              <textarea value={form.idea} onChange={(event) => setField("idea", event.target.value)} rows={3} required />
            </label>
            <label>План работы
              <textarea value={form.plan} onChange={(event) => setField("plan", event.target.value)} rows={3} required />
            </label>
            <label>Срок
              <input value={form.duration} onChange={(event) => setField("duration", event.target.value)} placeholder="Например, две недели" required />
            </label>
            <label>Ссылка на прототип
              <input type="url" value={form.prototypeUrl} onChange={(event) => setField("prototypeUrl", event.target.value)} placeholder="https://example.com/prototype" required />
            </label>
            {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
            {success && <p className="notice notice-success" role="status">{success}</p>}
            <button type="submit" className="button-primary" disabled={pending}>
              {pending ? "Отправляем…" : "Отправить предложение"}
            </button>
          </form>

          <h3>Мои отклики ({proposals.length})</h3>
          {proposals.length === 0 ? (
            <p className="muted">Вы ещё не отправляли предложений по этой задаче.</p>
          ) : (
            <div className="proposal-list">
              {proposals.map((proposal) => (
                <article className="proposal-card" key={proposal.id}>
                  <span className={"status-badge status-" + proposal.status}>{statusLabels[proposal.status]}</span>
                  <p><strong>Идея:</strong> {proposal.idea}</p>
                  <p><strong>План:</strong> {proposal.plan}</p>
                  <p><strong>Срок:</strong> {proposal.duration}</p>
                  <a className="text-link" href={proposal.prototypeUrl} target="_blank" rel="noopener noreferrer">Открыть прототип ↗</a>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
