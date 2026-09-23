import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api";
import type { ProgressConfirmation, Proposal, ProposalStatus } from "../../shared/types";
import { confirmTaskProgress, getTaskProgress, getTaskProposals, updateProposalStatus } from "./api";

interface BusinessProposalsProps {
  actorId: number;
  taskId: number;
}

const statusLabels: Record<ProposalStatus, string> = {
  submitted: "На рассмотрении",
  selected: "Выбрано",
  rejected: "Отклонено",
};

export function BusinessProposals({ actorId, taskId }: BusinessProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [progress, setProgress] = useState<ProgressConfirmation[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [teamPoints, setTeamPoints] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setProposals([]);
    setProgress([]);

    Promise.all([getTaskProposals(taskId), getTaskProgress(taskId)])
      .then(([savedProposals, savedProgress]) => {
        if (cancelled) return;
        setProposals(savedProposals);
        setProgress(savedProgress);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(cause instanceof ApiError ? cause.message : "Не удалось загрузить предложения.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorId, taskId, reloadKey]);

  async function decide(proposalId: number, status: "selected" | "rejected") {
    setPending("proposal:" + proposalId);
    setActionError("");
    setSuccess("");
    try {
      const updated = await updateProposalStatus(proposalId, status);
      setProposals((current) => current.map((item) => item.id === proposalId ? updated : item));
      setSuccess(status === "selected" ? "Команда выбрана." : "Отклик отклонён.");
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Не удалось сохранить решение.");
    } finally {
      setPending(null);
    }
  }

  async function confirm(teamId: number) {
    const note = (notes[teamId] || "").trim();
    setActionError("");
    setSuccess("");
    if (!note) {
      setActionError("Опишите подтверждённый прогресс команды.");
      return;
    }

    setPending("progress:" + teamId);
    try {
      const result = await confirmTaskProgress(taskId, teamId, note);
      setProgress((current) => [...current, result.confirmation]);
      setTeamPoints((current) => ({ ...current, [teamId]: result.team.points }));
      setSuccess("Прогресс подтверждён, команде начислено " + result.confirmation.points + " баллов.");
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Не удалось подтвердить прогресс.");
    } finally {
      setPending(null);
    }
  }

  const confirmedTeams = new Set(progress.map((item) => item.teamId));
  const selectedTeams = proposals
    .filter((item) => item.status === "selected")
    .filter((item, index, all) => all.findIndex((other) => other.teamId === item.teamId) === index);

  return (
    <section className="detail-card proposal-section">
      <div className="section-heading">
        <div>
          <h2>Отклики команд</h2>
          <p className="muted">Выберите одну или несколько команд, отклоните отклик или оставьте задачу без выбора.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading || pending !== null}>
          Обновить отклики
        </button>
      </div>

      {loading && <p role="status">Загружаем предложения…</p>}
      {loadError && <p className="notice notice-error" role="alert">{loadError}</p>}
      {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
      {success && <p className="notice notice-success" role="status">{success}</p>}

      {!loading && !loadError && (
        <>
          {proposals.length === 0 ? (
            <p className="muted">На эту задачу пока никто не откликнулся.</p>
          ) : (
            <div className="proposal-list">
              {proposals.map((proposal) => (
                <article className="proposal-card" key={proposal.id}>
                  <div className="section-heading">
                    <h3>{proposal.teamName}</h3>
                    <span className={"status-badge status-" + proposal.status}>{statusLabels[proposal.status]}</span>
                  </div>
                  <p><strong>Идея:</strong> {proposal.idea}</p>
                  <p><strong>План:</strong> {proposal.plan}</p>
                  <p><strong>Срок:</strong> {proposal.duration}</p>
                  <a className="text-link" href={proposal.prototypeUrl} target="_blank" rel="noopener noreferrer">Открыть прототип ↗</a>

                  {confirmedTeams.has(proposal.teamId) ? (
                    <p className="muted">Прогресс этой команды уже подтверждён.</p>
                  ) : (
                    <div className="action-row">
                      <button type="button" className="button-primary" onClick={() => decide(proposal.id, "selected")} disabled={pending !== null || proposal.status === "selected"}>
                        Выбрать
                      </button>
                      <button type="button" className="button-secondary" onClick={() => decide(proposal.id, "rejected")} disabled={pending !== null || proposal.status === "rejected"}>
                        Отклонить
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {selectedTeams.length > 0 && (
            <div className="progress-list">
              <h3>Подтверждение прогресса</h3>
              {selectedTeams.map((proposal) => {
                const confirmation = progress.find((item) => item.teamId === proposal.teamId);
                return (
                  <div className="progress-card" key={proposal.teamId}>
                    <strong>{proposal.teamName}</strong>
                    {confirmation ? (
                      <p className="muted">
                        Подтверждено: {confirmation.note}. Начислено {confirmation.points} баллов.
                        {teamPoints[proposal.teamId] !== undefined && " Всего у команды: " + teamPoints[proposal.teamId] + "."}
                      </p>
                    ) : (
                      <>
                        <label>Что команда уже сделала
                          <textarea rows={2} value={notes[proposal.teamId] || ""} onChange={(event) => setNotes((current) => ({ ...current, [proposal.teamId]: event.target.value }))} />
                        </label>
                        <button type="button" className="button-primary" onClick={() => confirm(proposal.teamId)} disabled={pending !== null}>
                          {pending === "progress:" + proposal.teamId ? "Подтверждаем…" : "Подтвердить прогресс"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
