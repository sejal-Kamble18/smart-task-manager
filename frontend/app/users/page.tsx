"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, UserRound, X } from "lucide-react";
import Modal from "@/components/Modal";
import Sidebar from "@/components/Sidebar";
import { api, getSession } from "@/lib/api";
import type { User } from "@/types";

/** Admin-only directory and account creation flow, backed by the storage service. */
export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [pending, setPending] = useState(false);
  const load = useCallback(() => api.users.list().then(setUsers).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load users")), []);
  useEffect(() => { if (getSession()?.user.role !== "admin") { router.replace("/dashboard"); return; } load(); }, [load, router]);
  async function create(event: FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await api.users.create(name, email, password); setName(""); setEmail(""); setPassword(""); setOpen(false); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create user"); } finally { setPending(false); } }
  return <Sidebar title="Users">{error && !open ? <p className="text-sm text-rose-600">{error}</p> : <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold sm:text-3xl">Team members</h2><p className="mt-1 text-sm text-slate-500 sm:text-base">Create accounts and assign work from one workspace.</p></div><button onClick={() => { setError(""); setOpen(true); }} className="btn btn-primary"><Plus size={16} />Create User</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{users.map((user) => <article key={user.id} className="card p-5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700">{user.name[0]}</span><div className="min-w-0"><h3 className="truncate font-bold">{user.name}</h3><p className="truncate text-sm text-slate-500">{user.email}</p></div></div><div className="mt-5 flex items-center gap-2 text-xs font-semibold capitalize text-slate-500">{user.role === "admin" ? <Shield size={14} className="text-indigo-600" /> : <UserRound size={14} />} {user.role}</div></article>)}</div></>}{open && <Modal title="Create user" onClose={() => setOpen(false)}><form onSubmit={create} className="space-y-4"><button type="button" onClick={() => setOpen(false)} className="sr-only"><X /></button><label className="block text-sm font-medium">Name<input className="field mt-1.5" required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium">Email<input className="field mt-1.5" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="block text-sm font-medium">Temporary password<input className="field mt-1.5" type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="text-sm text-rose-600">{error}</p>}<div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create user"}</button></div></form></Modal>}</Sidebar>;
}
