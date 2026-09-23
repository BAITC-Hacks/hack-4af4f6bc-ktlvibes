import { request } from "../../shared/api";
import type { PublishedTask, RatingLevel, Task } from "../../shared/types";

export interface CatalogFilters {
  topic?: string;
  level?: RatingLevel | "";
}

export function getCatalog(filters: CatalogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.level) params.set("level", filters.level);
  const query = params.toString();
  return request<PublishedTask[]>(query ? `/api/tasks?${query}` : "/api/tasks");
}

export function getTask(taskId: number, actorId?: number) {
  return request<Task>(`/api/tasks/${taskId}`, { actorId });
}
