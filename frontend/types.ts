export type Priority = "Low" | "Medium" | "High";
export type Status = "To Do" | "In Progress" | "Done";
export type Role = "admin" | "user";
export interface User { id: string; name: string; email: string; role: Role; createdAt: string; }
export interface Session { user: User; token: string; }
export interface TaskHistoryEntry { id: string; action: string; detail: string; at: string; }
export interface Task { id: string; title: string; description: string; priority: Priority; status: Status; assignedTo: string | null; dependencies: string[]; createdAt: string; updatedAt: string; history: TaskHistoryEntry[]; blockedBy?: Task[]; }
export interface TaskInput { title: string; description: string; priority: Priority; status: Status; assignedTo: string | null; dependencies: string[]; }
