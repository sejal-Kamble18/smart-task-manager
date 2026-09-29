import { sessionStore, storageHelpers, taskStore, userStore } from "@/lib/storage";
import type { Session, Status, Task, TaskInput } from "@/types";

/** Application data facade; swap its internals for HTTP later without rewriting UI. */
const resolved = <T>(operation: () => T): Promise<T> => {
  try { return Promise.resolve(operation()); } catch (error) { return Promise.reject(error); }
};

export const getSession = (): Session | null => sessionStore.get();
export const setSession = (session: Session | null) => sessionStore.set(session);

export const api = {
  auth: {
    login: (email: string, password: string) => resolved(() => userStore.login(email, password)),
    logout: () => resolved(() => { sessionStore.set(null); return null; }),
  },
  users: {
    list: () => resolved(() => userStore.list()),
    create: (name: string, email: string, password: string) => resolved(() => userStore.create(name, email, password)),
  },
  dashboard: () => resolved(() => {
    const tasks = taskStore.list();
    const user = getSession()?.user;
    const users = user?.role === "admin" ? userStore.list() : user ? [user] : [];
    return { tasks, users, stats: {
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "To Do").length,
      progress: tasks.filter((task) => task.status === "In Progress").length,
      done: tasks.filter((task) => task.status === "Done").length,
      blocked: tasks.filter((task) => storageHelpers.isBlocked(task, tasks)).length,
    } };
  }),
  tasks: {
    list: () => resolved(() => taskStore.list()),
    blocked: () => resolved(() => { const tasks = taskStore.list(); return tasks.filter((task) => storageHelpers.isBlocked(task, tasks)); }),
    create: (input: TaskInput) => resolved(() => taskStore.create(input)),
    update: (id: string, input: TaskInput) => resolved(() => taskStore.update(id, input)),
    status: (id: string, status: Status) => resolved(() => taskStore.setStatus(id, status)),
    remove: (id: string) => resolved(() => taskStore.remove(id)),
  },
};

export const blocked = (task: Task, all: Task[]) => storageHelpers.isBlocked(task, all);
