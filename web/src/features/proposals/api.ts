import { request } from "../../shared/api";
import type { ProgressConfirmation, Proposal, ProposalStatus, Team } from "../../shared/types";

export interface CreateProposalInput {
  idea: string;
  plan: string;
  duration: string;
  prototypeUrl: string;
}

export function getTeams() {
  return request<Team[]>("/api/teams");
}

export function createProposal(taskId: number, actorId: number, input: CreateProposalInput) {
  return request<Proposal>(`/api/tasks/${taskId}/proposals`, {
    method: "POST",
    actorId,
    body: input,
  });
}

export function getMyProposals(taskId: number, actorId: number) {
  return request<Proposal[]>(`/api/tasks/${taskId}/my-proposals`, { actorId });
}

export function getTaskProposals(taskId: number, actorId: number) {
  return request<Proposal[]>(`/api/tasks/${taskId}/proposals`, { actorId });
}

export function updateProposalStatus(proposalId: number, actorId: number, status: Extract<ProposalStatus, "selected" | "rejected">) {
  return request<Proposal>(`/api/proposals/${proposalId}/status`, {
    method: "PATCH",
    actorId,
    body: { status },
  });
}

export function getTaskProgress(taskId: number, actorId: number) {
  return request<ProgressConfirmation[]>(`/api/tasks/${taskId}/progress`, { actorId });
}

export function confirmTaskProgress(taskId: number, actorId: number, teamId: number, note: string) {
  return request<{ confirmation: ProgressConfirmation; team: Team }>(`/api/tasks/${taskId}/progress`, {
    method: "POST",
    actorId,
    body: { teamId, note },
  });
}
