"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, ListTodo, PlayCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TaskCard from "@/components/TaskCard";
import { api, getSession } from "@/lib/api";
import type { Status, Task, User } from "@/types";

type DashboardData = { tasks: Task[]; users: User[]; stats: { total: number; todo: number; progress: number; done: number; blocked: number } };

/** Dashboard uses server-calculated statistics and only shows task data available to the signed-in user. */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const user = getSession()?.user;
  const load = useCallback(async () => { try { setError(""); setData(await api.dashboard()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load dashboard"); } }, []);
  useEffect(() => {
    let active = true;
    api.dashboard().then((next) => { if (active) setData(next); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard"); });
    return () => { active = false; };
  }, []);
  async function updateStatus(task: Task, status: Status) { try { await api.tasks.status(task.id, status); await load(); } catch (reason) { alert(reason instanceof Error ? reason.message : "Unable to update task status"); } }

  const metrics = data ? [[ListTodo, "Total Tasks", data.stats.total, "bg-indigo-50 text-indigo-600"], [Clock3, "To Do", data.stats.todo, "bg-amber-50 text-amber-600"], [PlayCircle, "In Progress", data.stats.progress, "bg-blue-50 text-blue-600"], [CheckCircle2, "Completed", data.stats.done, "bg-emerald-50 text-emerald-600"], [AlertTriangle, "Blocked", data.stats.blocked, "bg-rose-50 text-rose-600"]] as const : [];
  return <Sidebar title="Dashboard">{error ? <p className="text-sm text-rose-600">{error}</p> : !data ? <p className="text-sm text-slate-500">Loading dashboard…</p> : <div className="space-y-6 sm:space-y-7"><div><h2 className="text-2xl font-bold text-[#102047] sm:text-3xl">{user?.role === "admin" ? "Dashboard" : `Welcome back, ${user?.name}`}</h2><p className="mt-1 text-sm text-slate-500 sm:text-base">Here’s what’s happening with your tasks today.</p></div><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metrics.map(([Icon, label, value, color]) => <div key={label} className="card flex items-center gap-4 p-4 sm:p-5"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl sm:size-12 ${color}`}><Icon size={23} /></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-[#102047]">{value}</p></div></div>)}</section><section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(15rem,.75fr)]"><div className="card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold">{user?.role === "admin" ? "Recent Tasks" : "My Tasks"}</h3><span className="text-sm text-slate-500">{data.tasks.length} total</span></div><div className="space-y-3">{data.tasks.length ? data.tasks.slice(0, 5).map((task) => <TaskCard key={task.id} task={task} allTasks={data.tasks} users={data.users} canManage={false} onEdit={() => undefined} onDelete={() => undefined} onStatus={updateStatus} />) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center sm:p-10"><p className="font-semibold">No tasks yet</p><p className="mt-1 text-sm text-slate-500">{user?.role === "admin" ? "Create your first task to start tracking real work." : "Tasks assigned to you will appear here."}</p></div>}</div></div><aside className="card p-5 sm:p-6"><h3 className="font-bold">Workspace overview</h3><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Visible tasks</dt><dd className="font-bold">{data.stats.total}</dd></div>{user?.role === "admin" && <div className="flex justify-between gap-4"><dt className="text-slate-500">Team members</dt><dd className="font-bold">{data.users.length}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-slate-500">In progress</dt><dd className="font-bold">{data.stats.progress}</dd></div></dl></aside></section></div>}</Sidebar>;
}
