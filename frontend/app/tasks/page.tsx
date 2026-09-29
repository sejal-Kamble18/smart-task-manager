"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/Modal";
import Sidebar from "@/components/Sidebar";
import TaskCard from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";
import { api, getSession } from "@/lib/api";
import type { Priority, Status, Task, TaskInput, User } from "@/types";

type View = "all" | "mine" | "blocked";

/** Shared task view: it keeps all accessible tasks for dependency context and filters the rendered list locally. */
export default function TasksPage() {
  const params = useSearchParams();
  const router = useRouter();
  const requestedView = params.get("view");
  const view: View = requestedView === "mine" || requestedView === "blocked" ? requestedView : "all";
  const session = useMemo(() => getSession(), []);
  const isAdmin = session?.user.role === "admin";
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [priority, setPriority] = useState<"All" | Priority>("All");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(params.get("create") === "1");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [taskData, userData] = await Promise.all([api.tasks.list(), isAdmin ? api.users.list() : Promise.resolve(session ? [session.user] : [])]);
      setAllTasks(taskData);
      setUsers(userData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load tasks"); }
  }, [isAdmin, session]);
  useEffect(() => {
    let active = true;
    Promise.all([api.tasks.list(), isAdmin ? api.users.list() : Promise.resolve(session ? [session.user] : [])])
      .then(([taskData, userData]) => { if (active) { setAllTasks(taskData); setUsers(userData); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load tasks"); });
    return () => { active = false; };
  }, [isAdmin, session]);

  const visibleTasks = useMemo(() => allTasks.filter((task) => {
    const inView = view === "all" || (view === "mine" ? task.assignedTo === session?.user.id : task.status !== "Done" && task.dependencies.some((id) => allTasks.find((candidate) => candidate.id === id)?.status !== "Done"));
    return inView && task.title.toLowerCase().includes(query.trim().toLowerCase()) && (status === "All" || task.status === status) && (priority === "All" || task.priority === priority);
  }), [allTasks, priority, query, session?.user.id, status, view]);

  const title = view === "mine" ? "My Tasks" : view === "blocked" ? "Blocked Tasks" : "All Tasks";
  const closeModal = () => { setOpen(false); setEditing(null); router.replace(`/tasks?view=${view}`); };
  async function save(input: TaskInput) { if (editing) await api.tasks.update(editing.id, input); else await api.tasks.create(input); closeModal(); await load(); }
  async function updateStatus(task: Task, nextStatus: Status) { try { await api.tasks.status(task.id, nextStatus); await load(); } catch (reason) { alert(reason instanceof Error ? reason.message : "Unable to update task status"); } }
  async function remove(task: Task) { if (!confirm(`Delete “${task.title}”?`)) return; try { await api.tasks.remove(task.id); await load(); } catch (reason) { alert(reason instanceof Error ? reason.message : "Unable to delete task"); } }

  const modalOpen = open || (isAdmin && params.get("create") === "1");
  return <Sidebar title={title}><div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks…" /><select className="field" value={status} onChange={(event) => setStatus(event.target.value as "All" | Status)}>{["All", "To Do", "In Progress", "Done"].map((item) => <option key={item}>{item}</option>)}</select><select className="field" value={priority} onChange={(event) => setPriority(event.target.value as "All" | Priority)}>{["All", "Low", "Medium", "High"].map((item) => <option key={item}>{item}</option>)}</select></div>{error ? <p className="text-sm text-rose-600">{error}</p> : <div className="space-y-4">{visibleTasks.length ? visibleTasks.map((task) => <TaskCard key={task.id} task={task} allTasks={allTasks} users={users} canManage={Boolean(isAdmin)} onEdit={(item) => { setEditing(item); setOpen(true); }} onDelete={remove} onStatus={updateStatus} />) : <div className="card p-8 text-center sm:p-12"><p className="font-bold">No tasks found</p><p className="mt-1 text-sm text-slate-500">{isAdmin ? "Create a task when work is ready to be planned." : "You have no assigned tasks in this view."}</p></div>}</div>}{modalOpen && isAdmin && <Modal title={editing ? "Edit task" : "Create task"} onClose={closeModal}><TaskForm users={users} tasks={allTasks} initial={editing} onSubmit={save} onCancel={closeModal} /></Modal>}</Sidebar>;
}
