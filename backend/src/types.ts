export type Priority = "Low" | "Medium" | "High";
export type Status = "To Do" | "In Progress" | "Done";
export type Role = "admin" | "user";
export interface User { id: string; name: string; email: string; password: string; role: Role; createdAt: string; }
export interface PublicUser { id: string; name: string; email: string; role: Role; createdAt: string; }
export interface Task { id: string; title: string; description: string; priority: Priority; status: Status; assignedTo: string | null; dependencies: string[]; createdAt: string; updatedAt: string; }
