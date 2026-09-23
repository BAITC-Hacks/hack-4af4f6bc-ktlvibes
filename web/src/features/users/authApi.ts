import { request } from "../../shared/api";
import type { User } from "../../shared/types";

export interface RegisterInput {
  role: User["role"];
  name: string;
  email: string;
  password: string;
  interests: string;
  skills: string;
  technologies: string;
}

export type ProfileUpdate = Partial<RegisterInput>;

export const getCurrentUser = () => request<User>("/api/auth/me");
export const login = (email: string, password: string) => request<User>("/api/auth/login", { method: "POST", body: { email, password } });
export const logout = () => request<void>("/api/auth/logout", { method: "POST" });
export const register = (input: RegisterInput) => request<User>("/api/users", { method: "POST", body: input });
export const updateProfile = (id: number, input: ProfileUpdate) => request<User>(`/api/users/${id}`, { method: "PATCH", body: input });
export const deleteProfile = (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" });
