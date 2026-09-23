import { request } from "../../shared/api";
import type { CardFields, QuestionsResponse, Rating, SavedDraftResponse, Task } from "../../shared/types";

export const getMyTasks = () => request<Task[]>("/api/tasks/mine");
export const getTask = (id: number) => request<Task>(`/api/tasks/${id}`);
export const createDraft = (initialDescription: string, topic: string) =>
  request<Task>("/api/tasks/drafts", { method: "POST", body: { initialDescription, topic } });
export const getQuestions = (id: number, initialDescription: string, card: CardFields) =>
  request<QuestionsResponse>(`/api/tasks/${id}/questions`, { method: "POST", body: { initialDescription, card } });
export const scorePreview = (id: number, card: CardFields) =>
  request<Rating>(`/api/tasks/${id}/score-preview`, { method: "POST", body: { card } });
export const saveDraft = (id: number, card: CardFields) =>
  request<SavedDraftResponse>(`/api/tasks/${id}/draft`, { method: "PUT", body: { card } });
export const confirmTask = (id: number, card: CardFields) =>
  request<Task>(`/api/tasks/${id}/confirm`, { method: "PUT", body: { card } });
