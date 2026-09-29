"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Priority, Status, Task, TaskInput, User } from "@/types";

const priorities: Priority[] = ["Low", "Medium", "High"];
const statuses: Status[] = ["To Do", "In Progress", "Done"];

/** Admin task editor. Dependency choices omit the task itself; the API validates cycles. */
export default function TaskForm({ users, tasks, initial, onSubmit, onCancel }: { users: User[]; tasks: Task[]; initial?: Task | null; onSubmit: (input: TaskInput) => Promise<void>; onCancel: () => void; }) {
  const [input, setInput] = useState<TaskInput>({ title: initial?.title ?? "", description: initial?.description ?? "", priority: initial?.priority ?? "Medium", status: initial?.status ?? "To Do", assignedTo: initial?.assignedTo ?? null, dependencies: initial?.dependencies ?? [] });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dependencyOptions = useMemo(() => tasks.filter((task) => task.id !== initial?.id), [initial?.id, tasks]);

  const change = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const toggleDependency = (id: string) => change("dependencies", input.dependencies.includes(id) ? input.dependencies.filter((dependency) => dependency !== id) : [...input.dependencies, id]);
  async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await onSubmit(input); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save task"); setPending(false); } }

  return <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Title<input required value={input.title} onChange={(event) => change("title", event.target.value)} className="field mt-1.5" placeholder="What needs to be done?" /></label><label className="block text-sm font-medium">Description<textarea value={input.description} onChange={(event) => change("description", event.target.value)} className="field mt-1.5 min-h-24" placeholder="Add useful context" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Priority<select value={input.priority} onChange={(event) => change("priority", event.target.value as Priority)} className="field mt-1.5">{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label className="text-sm font-medium">Status<select value={input.status} onChange={(event) => change("status", event.target.value as Status)} className="field mt-1.5">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><label className="block text-sm font-medium">Assign to<select value={input.assignedTo ?? ""} onChange={(event) => change("assignedTo", event.target.value || null)} className="field mt-1.5"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></label><fieldset><legend className="text-sm font-medium">Dependencies</legend><p className="mt-1 text-xs text-slate-500">This task cannot be completed until every selected task is done.</p><div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2">{dependencyOptions.length ? dependencyOptions.map((task) => <label key={task.id} className="flex cursor-pointer gap-2 rounded-lg p-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={input.dependencies.includes(task.id)} onChange={() => toggleDependency(task.id)} />{task.title}<span className="text-slate-400">({task.status})</span></label>) : <p className="p-2 text-sm text-slate-500">No tasks available.</p>}</div></fieldset>{error && <p className="text-sm text-rose-600">{error}</p>}<div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button><button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save task"}</button></div></form>;
}
