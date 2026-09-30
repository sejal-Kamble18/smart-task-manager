import { Router, type Request, type Response, type NextFunction } from "express";  //NextFunction → TypeScript type for middleware's next() ; "type" keyword tells TypeScript that those particular imports
import { z } from "zod";  // validates(checks) incoming data - id , p/w
import { blockingDependencies, isBlocked, newId, now,  users, sessions, tasks } from "./store"; //current backend does not appear to use a database => everything exists only in the Node process's memory.
import type { PublicUser, Status, Task, User } from "./types";

// This router contains every API endpoint used by the task manager.
export const router = Router();

//With as const, TypeScript understands them as literal values. without it treat as strings
const priorities = ["Low", "Medium", "High"] as const;
const statuses = ["To Do", "In Progress", "Done"] as const;

// Remove the password before returning a user in any API response.
const publicUser = (u: User): PublicUser => ({ 
  id: u.id, 
  name: u.name, 
  email: u.email, 
  role: u.role, 
  createdAt: u.createdAt
});
//creates a reusable success-response format = Good reusable helper
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ success: false, message });
// Validate input once and send a readable error when a field is invalid.
const parse = <T,>(schema: z.ZodType<T>, body: unknown, res: Response): T | null => { 
  const r = schema.safeParse(body); 
  if (!r.success) { fail(res, r.error.issues[0]?.message ?? "Invalid request"); return null; } 
  return r.data; };

const loginBody = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const signupBody = z.object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string().min(6, "Password must be at least 6 characters") });
const taskBody = z.object({ 
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  priority: z.enum(priorities), 
  status: z.enum(statuses),
  assignedTo: z.string().nullable().optional(),
  dependencies: z.array(z.string()).optional() });

type AuthedRequest = Request & { user?: User };
// checks whether the request is authenticated => Read the bearer token and attach its user to the request for later handlers.
function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  const user = token ? users.get(sessions.get(token) ?? "") : undefined;
  if (!user) return fail(res, "Authentication required", 401);
  req.user = user; next(); }

// Admin-only routes use this after auth so req.user is already available.
function admin(req: AuthedRequest, res: Response, next: NextFunction) { 
  if (req.user?.role !== "admin") 
    return fail(res, "Admin access required", 403); 
  next(); }

function userByEmail(email: string) { return [...users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase()); }
// Walk the dependency graph before mutation to reject self-references and circular chains.
function validDeps(id: string | null, deps: string[]) { 
  const unique = [...new Set(deps)]; 
    if (id && unique.includes(id)) 
      return "A task cannot depend on itself"; 
    if (unique.some((dep) => !tasks.has(dep))) 
      return "One or more dependencies do not exist"; 
  const visit = (current: string, seen = new Set<string>()): boolean => { if (current === id) 
    return true; if (seen.has(current)) return false; 
    seen.add(current); return (tasks.get(current)?.dependencies ?? []).some((child) => visit(child, seen)); }; 
    return id && unique.some((dep) => visit(dep)) ? "Dependencies cannot form a cycle" : null; }

// A regular user may view or update only a task assigned to them.
function taskAllowed(user: User, task: Task) { return user.role === "admin" || task.assignedTo === user.id; }
// This API-side guard is authoritative even if a client bypasses the disabled UI option.
function statusError(task: Task, status: Status) { return status === "Done" && isBlocked(task) ? "Task cannot be completed because one or more dependencies are incomplete." : null; }

// Accounts are provisioned by an administrator; public sign-up is deliberately disabled.
router.post("/auth/users", auth, admin, (req, res) => { 
  const body = parse(signupBody, req.body, res); 
    if (!body) return; if (userByEmail(body.email)) return fail(res, "A user with this email already exists", 409); 
  const user: User = { id: newId(), name: body.name, email: body.email.toLowerCase(), password: body.password, role: "user", createdAt: now() }; 
        users.set(user.id, user); return ok(res, publicUser(user), 201); });

router.post("/auth/login", (req, res) => { 
  const body = parse(loginBody, req.body, res); 
    if (!body) return; const user = userByEmail(body.email); if (!user || user.password !== body.password) return fail(res, "Invalid email or password", 401); 
  const token = newId(); sessions.set(token, user.id); 
    return ok(res, { user: publicUser(user), token }); });

router.post("/auth/logout", auth, (req: AuthedRequest, res) => { 
  const token = req.header("Authorization")?.replace("Bearer ", ""); 
    if (token) sessions.delete(token); return ok(res, null); });

router.get("/users", auth, admin, (_req, res) => ok(res, [...users.values()].map(publicUser)));
router.get("/dashboard", auth, (req: AuthedRequest, res) => { 
  const visible = req.user!.role === "admin" ? [...tasks.values()] : [...tasks.values()].filter((t) => t.assignedTo === req.user!.id); 
  return ok(res, { tasks: visible, stats: { total: visible.length, todo: visible.filter((t) => t.status === "To Do").length, progress: visible.filter((t) => t.status === "In Progress").length, 
          done: visible.filter((t) => t.status === "Done").length, 
          blocked: visible.filter(isBlocked).length }, 
          users: req.user!.role === "admin" ? [...users.values()].map(publicUser) : [publicUser(req.user!)] }); });

// List filtering is enforced at the API boundary, not just in the React views.
router.get("/tasks", auth, (req: AuthedRequest, res) => {
  const visible = req.user!.role === "admin" ? [...tasks.values()] : [...tasks.values()].filter((t) => t.assignedTo === req.user!.id);
  return ok(res, visible);
});

// Get all blocked tasks that the current user is allowed to see.
// "blockedBy" tells the frontend which dependency is preventing completion.
router.get("/tasks/blocked", auth, (req: AuthedRequest, res) => ok(res, [...tasks.values()].filter((t) => taskAllowed(req.user!, t) && isBlocked(t)).map((t) => ({ ...t, blockedBy: blockingDependencies(t) }))));

// Get one task by its ID. The user must be logged in and must have permission to view the task.
router.get("/tasks/:id", auth, (req: AuthedRequest, res) => { 
  // Find the task using the ID from the URL.
  const task = tasks.get(String(req.params.id)); if (!task || !taskAllowed(req.user!, task)) return fail(res, "Task not found", 404); return ok(res, task); });
// Create a new task.
// Only logged-in administrators are allowed to create tasks.
router.post("/tasks", auth, admin, (req, res) => { 
  const body = parse(taskBody, req.body, res); if (!body) return; 
  const deps = [...new Set(body.dependencies ?? [])]; if (body.assignedTo && !users.has(body.assignedTo)) return fail(res, "Assigned user does not exist"); 
  const dependencyError = validDeps(null, deps); if (dependencyError) return fail(res, dependencyError); 
  const task: Task = { id: newId(), title: body.title, description: body.description, priority: body.priority, status: body.status, assignedTo: body.assignedTo ?? null, dependencies: deps, createdAt: now(), updatedAt: now() }; 
  const error = statusError(task, task.status); if (error) return fail(res, error); tasks.set(task.id, task); return ok(res, task, 201); });
// Update an existing task.
// Only logged-in administrators can update tasks.
router.put("/tasks/:id", auth, admin, (req, res) => { 
  const previous = tasks.get(String(req.params.id)); if (!previous) return fail(res, "Task not found", 404); 
  const body = parse(taskBody, req.body, res); if (!body) return; 
  const deps = [...new Set(body.dependencies ?? [])]; if (body.assignedTo && !users.has(body.assignedTo)) return fail(res, "Assigned user does not exist"); 
  const dependencyError = validDeps(previous.id, deps); if (dependencyError) return fail(res, dependencyError); 
  const next: Task = { ...previous, ...body, assignedTo: body.assignedTo ?? null, dependencies: deps, updatedAt: now() }; 
  const error = statusError(next, next.status); if (error) return fail(res, error); tasks.set(next.id, next); return ok(res, next); });
// Change only the status of a task.
// A normal user can change the status of a task assigned to them.
// An admin can change any task.
router.patch("/tasks/:id/status", auth, (req: AuthedRequest, res) => { 
  const task = tasks.get(String(req.params.id)); if (!task || !taskAllowed(req.user!, task)) return fail(res, "Task not found", 404); 
  const body = parse(z.object({ status: z.enum(statuses) }), req.body, res); if (!body) return; 
  const error = statusError(task, body.status); if (error) return fail(res, error); 
  const next = { ...task, status: body.status, updatedAt: now() }; tasks.set(next.id, next); return ok(res, next); });
// Only administrators are allowed to delete tasks.
router.delete("/tasks/:id", auth, admin, (req, res) => { 
  const id = String(req.params.id); const task = tasks.get(id); if (!task) return fail(res, "Task not found", 404); 
  const dependents = [...tasks.values()].filter((t) => t.dependencies.includes(task.id)); 
  if (dependents.length) return fail(res, `Cannot delete task; required by ${dependents.map((t) => t.title).join(", ")}`); tasks.delete(id); return ok(res, task); });
