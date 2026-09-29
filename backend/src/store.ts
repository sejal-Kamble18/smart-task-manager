import { randomUUID } from "crypto";
import type { Task, User } from "./types";

// In-memory store deliberately starts clean on every server start.
// Maps provide quick lookup by ID while this exercise uses no database.
export const users = new Map<string, User>();
export const tasks = new Map<string, Task>();
// A session token points to the ID of the signed-in user.
export const sessions = new Map<string, string>();
export const now = () => new Date().toISOString();
export const newId = () => randomUUID();

// initial account. that control and assign the tasks.
users.set("admin", { id: "admin", name: "Admin", email: "admin@gmail.com", password: "admin123", role: "admin", createdAt: now() });

// Blocked is derived, never persisted: any non-completed dependency blocks completion.
export function isBlocked(task: Task) { return task.status !== "Done" && task.dependencies.some((id) => tasks.get(id)?.status !== "Done"); }
// Return unfinished prerequisite tasks so the UI can explain the block.
export function blockingDependencies(task: Task) { return task.dependencies.flatMap((id) => { const dependency = tasks.get(id); return dependency?.status !== "Done" ? (dependency ? [dependency] : []) : []; }); }
