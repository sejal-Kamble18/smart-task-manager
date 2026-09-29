"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { blocked } from "@/lib/api";
import type { Status, Task, User } from "@/types";

const priorityStyle: Record<Task["priority"], string> = { High: "bg-rose-50 text-rose-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-emerald-50 text-emerald-700" };

/** Task summary with controls limited to the actor permissions provided by its parent. */
export default function TaskCard({ task, allTasks, users, canManage, onEdit, onDelete, onStatus }: { task: Task; allTasks: Task[]; users: User[]; canManage: boolean; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onStatus: (task: Task, status: Status) => void; }) {
  const isBlocked = blocked(task, allTasks);
  const assignee = users.find((user) => user.id === task.assignedTo);
  const blockingTitles = task.dependencies.map((id) => allTasks.find((candidate) => candidate.id === id)).filter((candidate) => candidate?.status !== "Done").map((candidate) => candidate?.title).filter(Boolean);

  return (
    <article className="card p-4 transition hover:-translate-y-0.5 sm:p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#102047]">{task.title}</h3>{isBlocked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"><Lock size={12} /> Blocked</span>}</div>{task.description && <p className="mt-1 break-words text-sm leading-6 text-slate-500">{task.description}</p>}</div>
        <div className="flex shrink-0 gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle[task.priority]}`}>{task.priority}</span><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{task.status}</span></div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words text-xs text-slate-500">{assignee ? `Assigned to ${assignee.name}` : "Unassigned"} · {task.dependencies.length ? `${task.dependencies.length} ${task.dependencies.length === 1 ? "dependency" : "dependencies"}` : "No dependencies"}</p>
        <div className="flex flex-wrap gap-2"><select aria-label={`Change status for ${task.title}`} value={task.status} onChange={(event) => onStatus(task, event.target.value as Status)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm font-medium" disabled={task.status === "Done"}>{["To Do", "In Progress", "Done"].map((status) => <option key={status} disabled={isBlocked && status === "Done"}>{status}</option>)}</select>{canManage && <><button onClick={() => onEdit(task)} className="btn btn-secondary min-h-10 px-3 py-2"><Pencil size={15} /><span className="hidden sm:inline">Edit</span></button><button onClick={() => onDelete(task)} className="btn min-h-10 px-3 py-2 text-rose-600 hover:bg-rose-50" aria-label={`Delete ${task.title}`}><Trash2 size={16} /></button></>}</div>
      </div>
      {isBlocked && <p className="mt-3 break-words text-xs font-medium text-amber-700">Waiting for: {blockingTitles.join(", ") || "an incomplete dependency"}</p>}
    </article>
  );
}
