import { request } from "../../shared/api";
import type { CardFields, QuestionsResponse, Rating, SavedDraftResponse, Task } from "../../shared/types";

export const getMyTasks = (actorId: number) => request<Task[]>("/api/tasks/mine", { actorId });
export const getTask = (id: number, actorId: number) => request<Task>(`/api/tasks/${id}`, { actorId });
export const createDraft = (initialDescription: string, topic: string, actorId: number) =>
  request<Task>("/api/tasks/drafts", { method: "POST", actorId, body: { initialDescription, topic } });
export const getQuestions = (id: number, initialDescription: string, card: CardFields, actorId: number) =>
  request<QuestionsResponse>(`/api/tasks/${id}/questions`, { method: "POST", actorId, body: { initialDescription, card } });
export const scorePreview = (id: number, card: CardFields, actorId: number) =>
  request<Rating>(`/api/tasks/${id}/score-preview`, { method: "POST", actorId, body: { card } });
export const saveDraft = (id: number, card: CardFields, actorId: number) =>
  request<SavedDraftResponse>(`/api/tasks/${id}/draft`, { method: "PUT", actorId, body: { card } });
export const confirmTask = (id: number, card: CardFields, actorId: number) =>
  request<Task>(`/api/tasks/${id}/confirm`, { method: "PUT", actorId, body: { card } });
