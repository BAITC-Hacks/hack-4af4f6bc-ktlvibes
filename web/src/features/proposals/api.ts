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

export function createProposal(taskId: number, input: CreateProposalInput) {
  return request<Proposal>(`/api/tasks/${taskId}/proposals`, {
    method: "POST",
    body: input,
  });
}

export function getMyProposals(taskId: number) {
  return request<Proposal[]>(`/api/tasks/${taskId}/my-proposals`);
}

export function getTaskProposals(taskId: number) {
  return request<Proposal[]>(`/api/tasks/${taskId}/proposals`);
}

export function updateProposalStatus(proposalId: number, status: Extract<ProposalStatus, "selected" | "rejected">) {
  return request<Proposal>(`/api/proposals/${proposalId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function getTaskProgress(taskId: number) {
  return request<ProgressConfirmation[]>(`/api/tasks/${taskId}/progress`);
}

export function confirmTaskProgress(taskId: number, teamId: number, note: string) {
  return request<{ confirmation: ProgressConfirmation; team: Team }>(`/api/tasks/${taskId}/progress`, {
    method: "POST",
    body: { teamId, note },
  });
}
