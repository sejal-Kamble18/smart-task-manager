"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckSquare } from "lucide-react";
import { api, setSession } from "@/lib/api";

/** Only the seeded admin or users created in the workspace can sign in. */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { setSession(await api.auth.login(email, password)); router.replace("/dashboard"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in"); setPending(false); }
  }
  return <main className="grid min-h-screen bg-white lg:grid-cols-2">
    <section className="hidden bg-[#102047] p-12 text-white lg:flex lg:flex-col"><Link href="/" className="flex items-center gap-3 text-lg font-bold"><span className="grid size-10 place-items-center rounded-xl bg-indigo-500"><CheckSquare /></span>Smart Tasks</Link><div className="my-auto max-w-md"><p className="text-indigo-300">A clearer way to work</p><h1 className="mt-3 text-5xl font-bold leading-tight">Make progress visible.</h1><p className="mt-5 text-lg leading-8 text-indigo-100">One focused workspace for tasks, owners, and the dependencies that keep work in order.</p></div></section>
    <section className="flex items-center justify-center p-5"><div className="w-full max-w-md"><Link href="/" className="mb-10 flex items-center gap-2 font-bold lg:hidden"><CheckSquare className="text-indigo-600" />Smart Tasks</Link><p className="text-sm font-semibold text-indigo-600">WELCOME BACK</p><h1 className="mt-2 text-3xl font-bold">Sign in to Smart Tasks</h1><p className="mt-2 text-sm text-slate-500 sm:text-base">Use your workspace account to continue.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium">Email<input className="field mt-1.5" type="email" value={email} required autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></label><label className="block text-sm font-medium">Password<input className="field mt-1.5" type="password" value={password} minLength={6} required autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="text-sm text-rose-600">{error}</p>}<button disabled={pending} className="btn btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button></form><p className="mt-6 text-center text-xs text-slate-500">Need an account? Ask a workspace admin to create one.</p></div></section>
  </main>;
}
