"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckSquare, LayoutDashboard, ListTodo, LockKeyhole, LogOut, Menu, Plus, Users } from "lucide-react";
import Footer from "@/components/Footer";
import { api, getSession, setSession } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks?view=mine", label: "My Tasks", icon: CheckSquare },
  { href: "/tasks?view=all", label: "All Tasks", icon: ListTodo, admin: true },
  { href: "/tasks?view=blocked", label: "Blocked", icon: LockKeyhole, admin: true },
  { href: "/users", label: "Users", icon: Users, admin: true },
];

// This receives storage changes made by another browser tab.
const subscribeToSession = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
// localStorage is unavailable during server rendering.
const serverSession = () => null;

/**
 * The sole authenticated layout. It owns responsive navigation and the one
 * consistent New Task action so individual pages cannot accidentally duplicate it.
 */
export default function Sidebar({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // useSyncExternalStore keeps the server's first render and browser hydration aligned.
  const savedSession = useSyncExternalStore(subscribeToSession, getSession, serverSession);
  // Local changes do not emit a browser storage event in the same tab.
  const [localSession, setLocalSession] = useState<ReturnType<typeof getSession> | undefined>(undefined);
  const session = localSession === undefined ? savedSession : localSession;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getSession()) router.replace("/login");
  }, [router]);

  if (!session) return <div className="p-6 text-sm text-slate-500">Loading workspace…</div>;

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    return pathname === path && (!query || searchParams.get("view") === new URLSearchParams(query).get("view"));
  };

  const navigation = (
    <div className="flex h-full flex-col bg-[#0d1c3b] text-white">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-3 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/30"><CheckSquare size={20} /></span>
          Smart Tasks
        </Link>
        <p className="mt-2 text-xs text-indigo-200">Plan work. Make progress.</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.filter((link) => !link.admin || session.user.role === "admin").map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${isActive(link.href) ? "bg-indigo-500 text-white shadow-lg shadow-indigo-950/20" : "text-indigo-100 hover:bg-white/10"}`}>
              <Icon size={18} />{link.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-4 border-t border-white/10 pt-4">
        <p className="truncate text-sm font-semibold">{session.user.name}</p>
        <p className="text-xs capitalize text-indigo-200">{session.user.role}</p>
        <button onClick={async () => { try { await api.auth.logout(); } catch { /* local logout still clears expired sessions */ } setSession(null); setLocalSession(null); router.replace("/"); }} className="mt-4 flex w-full items-center gap-2 text-sm text-indigo-100 transition hover:text-white">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f9ff] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="hidden lg:block">{navigation}</aside>
      {menuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/50" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /><aside className="relative h-full w-[min(18rem,85vw)] shadow-2xl">{navigation}</aside></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-lg p-1 text-slate-800 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={25} /></button>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold text-[#102047] sm:text-xl">{title}</h1><p className="hidden text-xs text-slate-500 sm:block">{session.user.role === "admin" ? "Your workspace at a glance" : "Your assigned work"}</p></div>
          </div>
          {session.user.role === "admin" && <Link href="/tasks?view=all&create=1" className="btn btn-primary shrink-0 px-3 py-2 sm:px-4"><Plus size={16} />New Task</Link>}
        </header>
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1500px] flex-col p-4 sm:p-6 lg:p-7"><div className="flex-1">{children}</div><Footer /></main>
      </div>
    </div>
  );
}
