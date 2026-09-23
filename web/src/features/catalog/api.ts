import { request } from "../../shared/api";
import type { RatingLevel, Task } from "../../shared/types";

export interface CatalogFilters {
  topic?: string;
  level?: RatingLevel | "";
}

export function getCatalog(filters: CatalogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.level) params.set("level", filters.level);
  const query = params.size ? `?${params.toString()}` : "";
  return request<Task[]>(`/api/tasks${query}` as `/api/${string}`);
}

export function getTask(taskId: number, actorId?: number) {
  return request<Task>(`/api/tasks/${taskId}`, { actorId });
}
