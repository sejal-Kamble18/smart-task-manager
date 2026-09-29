import type { Priority, Role, Session, Status, Task, TaskInput, User } from "@/types";

/**
 * Browser persistence boundary. UI code calls this service instead of touching
 * localStorage, so it can be swapped for a remote repository later.
 */
// These keys are the only browser-storage names used by this application.
const KEYS = { users: "smart-tasks-users-v1", tasks: "smart-tasks-tasks-v1", session: "smart-tasks-session-v1" } as const;
type StoredUser = User & { password: string };
const admin: StoredUser = { id: "admin", name: "Admin", email: "admin@gmail.com", password: "admin123", role: "admin", createdAt: "2026-01-01T00:00:00.000Z" };

// Prefer the browser UUID, with a safe fallback for older environments.
function id() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
// Reading may happen during server rendering, so return a fallback outside the browser.
function read<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
// Keep JSON conversion in one place so UI components never touch localStorage.
function write<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }
// Seed only missing collections; existing browser data is never overwritten.
function ensureStore() { if (typeof window === "undefined") return; if (!localStorage.getItem(KEYS.users)) write(KEYS.users, [admin]); if (!localStorage.getItem(KEYS.tasks)) write(KEYS.tasks, []); }
function users() { ensureStore(); return read<StoredUser[]>(KEYS.users, [admin]); }
function tasks() { ensureStore(); return read<Task[]>(KEYS.tasks, []); }
function publicUser(user: StoredUser): User { const { password, ...safe } = user; void password; return safe; }
// Guards make permission rules work even if someone bypasses a hidden button.
function requireSession() { const session = sessionStore.get(); if (!session) throw new Error("Authentication required"); return session; }
function requireAdmin() { const session = requireSession(); if (session.user.role !== "admin") throw new Error("Admin access required"); return session; }
// A task is blocked until every task it depends on is marked Done.
function isBlocked(task: Task, allTasks: Task[]) { return task.status !== "Done" && task.dependencies.some((dependency) => allTasks.find((candidate) => candidate.id === dependency)?.status !== "Done"); }
// Every edit adds a small audit entry and refreshes the update timestamp.
function record(task: Task, action: string, detail: string): Task { return { ...task, updatedAt: new Date().toISOString(), history: [...task.history, { id: id(), action, detail, at: new Date().toISOString() }] }; }
function validateDependencies(taskId: string | null, dependencies: string[], allTasks: Task[]) {
  // Duplicate IDs add no value, so remove them before validating the graph.
  const unique = [...new Set(dependencies)];
  if (taskId && unique.includes(taskId)) throw new Error("A task cannot depend on itself");
  if (unique.some((dependency) => !allTasks.some((task) => task.id === dependency))) throw new Error("One or more dependencies do not exist");
  const reachesTask = (current: string, seen = new Set<string>()): boolean => { if (current === taskId) return true; if (seen.has(current)) return false; seen.add(current); return (allTasks.find((task) => task.id === current)?.dependencies ?? []).some((dependency) => reachesTask(dependency, seen)); };
  if (taskId && unique.some((dependency) => reachesTask(dependency))) throw new Error("Dependencies cannot form a cycle");
  return unique;
}

// Keep one parsed session object per raw value. React's external-store hook needs
// the same object reference until browser storage actually changes.
let cachedSessionRaw: string | null | undefined;
let cachedSession: Session | null = null;
function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.session);
  if (raw === cachedSessionRaw) return cachedSession;
  cachedSessionRaw = raw;
  try { cachedSession = raw ? JSON.parse(raw) as Session : null; } catch { cachedSession = null; }
  return cachedSession;
}
// Session is stored separately so logout does not erase users or tasks.
export const sessionStore = {
  get: getStoredSession,
  set: (value: Session | null) => {
    if (typeof window === "undefined") return;
    if (value) {
      const raw = JSON.stringify(value);
      localStorage.setItem(KEYS.session, raw);
      cachedSessionRaw = raw;
      cachedSession = value;
    } else {
      localStorage.removeItem(KEYS.session);
      cachedSessionRaw = null;
      cachedSession = null;
    }
  },
};
export const userStore = {
  // Never return passwords to any caller, including React components.
  list: (): User[] => users().map(publicUser),
  login: (email: string, password: string): Session => { const user = users().find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password); if (!user) throw new Error("Invalid email or password"); const session = { user: publicUser(user), token: id() }; sessionStore.set(session); return session; },
  create: (name: string, email: string, password: string): User => { requireAdmin(); const normalizedName = name.trim(); const normalizedEmail = email.trim().toLowerCase(); if (!normalizedName) throw new Error("Name is required"); if (users().some((user) => user.email === normalizedEmail)) throw new Error("A user with this email already exists"); if (password.length < 6) throw new Error("Password must be at least 6 characters"); const user: StoredUser = { id: id(), name: normalizedName, email: normalizedEmail, password, role: "user" as Role, createdAt: new Date().toISOString() }; write(KEYS.users, [...users(), user]); return publicUser(user); },
};
export const taskStore = {
  // Admins see the workspace; regular users see only work assigned to them.
  list: (): Task[] => { const session = requireSession(); const allTasks = tasks(); return session.user.role === "admin" ? allTasks : allTasks.filter((task) => task.assignedTo === session.user.id); },
  allForAdmin: (): Task[] => { requireAdmin(); return tasks(); },
  create: (input: TaskInput): Task => { const session = requireAdmin(); const allTasks = tasks(); if (input.assignedTo && !users().some((user) => user.id === input.assignedTo)) throw new Error("Assigned user does not exist"); const dependencies = validateDependencies(null, input.dependencies, allTasks); const now = new Date().toISOString(); const task: Task = { id: id(), ...input, dependencies, createdAt: now, updatedAt: now, history: [{ id: id(), action: "Created", detail: `Created by ${session.user.name}`, at: now }] }; if (input.status === "Done" && isBlocked(task, allTasks)) throw new Error("Task cannot be completed because one or more dependencies are incomplete."); write(KEYS.tasks, [...allTasks, task]); return task; },
  update: (taskId: string, input: TaskInput): Task => { const session = requireAdmin(); const allTasks = tasks(); const current = allTasks.find((task) => task.id === taskId); if (!current) throw new Error("Task not found"); if (input.assignedTo && !users().some((user) => user.id === input.assignedTo)) throw new Error("Assigned user does not exist"); const dependencies = validateDependencies(taskId, input.dependencies, allTasks); const candidate = { ...current, ...input, dependencies }; if (input.status === "Done" && isBlocked(candidate, allTasks)) throw new Error("Task cannot be completed because one or more dependencies are incomplete."); const next = record(candidate, "Updated", `Updated by ${session.user.name}`); write(KEYS.tasks, allTasks.map((task) => task.id === taskId ? next : task)); return next; },
  setStatus: (taskId: string, status: Status): Task => { const session = requireSession(); const allTasks = tasks(); const current = allTasks.find((task) => task.id === taskId); if (!current || (session.user.role !== "admin" && current.assignedTo !== session.user.id)) throw new Error("Task not found"); if (status === "Done" && isBlocked(current, allTasks)) throw new Error("Task cannot be completed because one or more dependencies are incomplete."); const next = record({ ...current, status }, "Status changed", `${current.status} → ${status} by ${session.user.name}`); write(KEYS.tasks, allTasks.map((task) => task.id === taskId ? next : task)); return next; },
  remove: (taskId: string): Task => { requireAdmin(); const allTasks = tasks(); const task = allTasks.find((candidate) => candidate.id === taskId); if (!task) throw new Error("Task not found"); if (allTasks.some((candidate) => candidate.dependencies.includes(taskId))) throw new Error("Cannot delete a task required by another task"); write(KEYS.tasks, allTasks.filter((candidate) => candidate.id !== taskId)); return task; },
};
export const storageHelpers = { isBlocked, priorities: ["Low", "Medium", "High"] as Priority[], statuses: ["To Do", "In Progress", "Done"] as Status[] };
