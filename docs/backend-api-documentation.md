# Backend API Documentation

## 1. Scope and architecture

The backend is a TypeScript Express application. It exposes an in-memory API for users, login sessions, dashboard data, and tasks. It has no controllers/services folder, database client, ORM, or external service: route handlers in `src/routes.ts` call helpers and `Map` objects from `src/store.ts` directly.

```text
Request
  → Express server
  → CORS / JSON middleware
  → route middleware (auth, admin where required)
  → Zod body validation
  → route handler + store helpers
  → Map-based in-memory data
  → { success, data } or { success: false, message }
```

### Design decisions

| Decision | What it does | Why it was chosen | Trade-off |
| --- | --- | --- | --- |
| Express router | Holds all endpoints in one small module. | The application is small and has few domain areas. | The module should be split as the API grows. |
| `Map` storage | Stores users, tasks, and sessions keyed by ID. | Meets the no-database exercise requirement and gives direct lookups. | Restarting the server clears data. |
| Zod schemas | Validates request bodies before mutation. | Provides concise, consistent input errors. | Validation is route-local rather than a shared service layer. |
| Bearer token map | Maps random server-generated tokens to user IDs. | Simple mock authentication for the assignment. | No expiry, hashing, cookies, or production-grade token security. |
| Derived blocked state | Calculates blocking from dependencies instead of storing a flag. | The value cannot become stale after a prerequisite changes. | Dependency checks inspect related tasks on each request. |

## 2. Folder structure

```text
backend/
├── src/
│   ├── server.ts      # Express application, CORS, JSON parsing, route mounts
│   ├── routes.ts      # Request schemas, middleware, endpoint handlers
│   ├── store.ts       # Maps, IDs/timestamps, blocked-task helpers, admin seed
│   └── types.ts       # User, public user, task, role, status, priority types
├── .env               # Local PORT and FRONTEND_URL configuration
├── package.json       # Development/start/typecheck scripts
└── tsconfig.json
```

## 3. Server configuration

`src/server.ts` loads environment values with `dotenv`, creates an Express application, enables CORS for `FRONTEND_URL` (default `http://localhost:3000`), enables `express.json()`, and mounts the same router twice:

```text
/api     ─┐
          ├── routes.ts
/api/v1  ─┘
```

The two prefixes expose identical endpoints. This means, for example, both `POST /api/auth/login` and `POST /api/v1/auth/login` are implemented. The v1 prefix supports the requested versioned form while the original prefix remains available.

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Listening port | `5000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |

No secret or API key environment variable is implemented. Do not place real credentials in documentation or source control.

## 4. Data model and persistence

### In-memory collections

| Collection | Key | Value | Persistence |
| --- | --- | --- | --- |
| `users` | User ID | `User`, including mock password field | Lost on server restart |
| `tasks` | Task ID | `Task` | Lost on server restart |
| `sessions` | Token | User ID | Lost on server restart |

The server seeds one administrator record at startup, but this document intentionally does not disclose any credentials. Regular users and all tasks start empty.

### Types

```ts
type Priority = "Low" | "Medium" | "High";
type Status = "To Do" | "In Progress" | "Done";
type Role = "admin" | "user";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  assignedTo: string | null;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}
```

The backend task type does not persist the frontend-only task history array.

## 5. Authentication and authorization

### Authentication flow

1. `POST /auth/login` validates email/password fields and finds a user by case-insensitive email.
2. If the mock password matches, the server creates a random ID token, stores `token → userId` in `sessions`, and returns the public user plus token.
3. Protected requests send `Authorization: Bearer <token>`.
4. `auth` middleware resolves the token to a user and assigns that user to `req.user`.
5. `POST /auth/logout` deletes the presented token.

### Authorization rules

| Action | Rule |
| --- | --- |
| List users / create user | Authenticated administrator only. |
| Create, update, delete task | Authenticated administrator only. |
| Read dashboard/tasks/blocked task list | Authenticated; regular users only see their assigned tasks. |
| Read one task | Authenticated; administrator or assigned user. |
| Change status | Authenticated; administrator or assigned user. |

The `admin` middleware always follows `auth`. `taskAllowed` applies resource-level access for a regular user's assigned task.

## 6. Common conventions

### Base URL

Use either base path:

```text
http://localhost:5000/api
http://localhost:5000/api/v1
```

Endpoint tables show only the path after the base URL.

### Headers

```http
Content-Type: application/json
Authorization: Bearer <token>   # required only where noted
```

### Response envelope

Successful responses:

```json
{ "success": true, "data": {} }
```

Error responses:

```json
{ "success": false, "message": "Human-readable explanation" }
```

## 7. Endpoint reference

### 7.1 Authentication and user management

| Method | Route | Auth / role | Request body | Success | Common errors |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | `{ "email": "user@example.com", "password": "..." }` | `200`, session `{ user, token }` | `400` invalid body; `401` invalid credentials |
| `POST` | `/auth/logout` | Authenticated | None | `200`, `data: null` | `401` authentication required |
| `POST` | `/auth/users` | Authenticated admin | `{ "name": "Name", "email": "user@example.com", "password": "minimum 6 chars" }` | `201`, public user | `400` invalid body; `401`; `403`; `409` duplicate email |
| `GET` | `/users` | Authenticated admin | None | `200`, public user array | `401`; `403` |

Example login request:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"replace-with-a-local-test-password"}'
```

The example uses placeholders and is not a usable credential.

### 7.2 Dashboard and task reads

| Method | Route | Auth / role | Request body | Success | Common errors |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/dashboard` | Authenticated | None | `200`, visible tasks, status counts, and users permitted for the caller | `401` |
| `GET` | `/tasks` | Authenticated | None | `200`, visible task array | `401` |
| `GET` | `/tasks/blocked` | Authenticated | None | `200`, visible blocked tasks, each with `blockedBy` | `401` |
| `GET` | `/tasks/:id` | Authenticated; admin or assignee | None | `200`, task | `401`; `404` absent/not allowed |

`/dashboard` returns:

```json
{
  "success": true,
  "data": {
    "tasks": [],
    "stats": { "total": 0, "todo": 0, "progress": 0, "done": 0, "blocked": 0 },
    "users": []
  }
}
```

For regular users, task lists and dashboard tasks are limited to their assigned task IDs. `/tasks/blocked` includes a `blockedBy` array of unfinished prerequisite task objects.

### 7.3 Task mutation endpoints

| Method | Route | Auth / role | Request body | Success | Common errors |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/tasks` | Authenticated admin | Complete task body | `201`, created task | `400` validation/dependency/done restriction; `401`; `403` |
| `PUT` | `/tasks/:id` | Authenticated admin | Complete task body | `200`, updated task | `400`; `401`; `403`; `404` missing task |
| `PATCH` | `/tasks/:id/status` | Authenticated; admin or assignee | `{ "status": "To Do" \| "In Progress" \| "Done" }` | `200`, updated task | `400` invalid/blocked Done; `401`; `404` absent/not allowed |
| `DELETE` | `/tasks/:id` | Authenticated admin | None | `200`, deleted task | `400` task has dependents; `401`; `403`; `404` |

Complete create/update task body:

```json
{
  "title": "Prepare release notes",
  "description": "Summarize the delivered changes.",
  "priority": "High",
  "status": "To Do",
  "assignedTo": null,
  "dependencies": []
}
```

`title`, `priority`, and `status` are required. `description` defaults to an empty string. `assignedTo` and `dependencies` are optional in the route schema; omitted values become `null` and `[]` in persisted tasks. A non-null assignee must exist.

## 8. Dependency validation and completion restriction

Before create/update, `validDeps`:

```text
candidate dependency IDs
  → remove duplicates
  → reject task's own ID
  → reject IDs not present in tasks Map
  → traverse existing dependency graph
  → reject a path that returns to the task being edited
```

`isBlocked(task)` derives the state by checking whether any dependency exists and is not `Done`. `statusError` rejects a request to create, update, or patch a task to `Done` when that task is blocked. The backend also refuses to delete a task needed by another task.

## 9. Validation and error handling

| Area | Current behavior |
| --- | --- |
| Request body | Zod schema parsing returns a `400` response with the first validation message. |
| Email matching | Lookup lowercases stored/comparison emails. |
| Duplicate user | User creation returns `409`. |
| Authentication | Missing/invalid session token returns `401`. |
| Role restriction | Non-admin use of admin route returns `403`. |
| Resource access | Missing task or a task not allowed to the caller returns `404`. |
| Dependencies | Invalid ID, self-reference, cycle, unsafe completion, and deletion with dependents return `400`. |

No global Express error handler is implemented. Unexpected thrown errors would follow Express's default error behavior.

## 10. Frontend integration status

The Express endpoints are implemented and runnable, but the existing Next.js UI does **not** currently call them. Its `frontend/lib/api.ts` delegates to browser local storage instead. The endpoint contract should be treated as the backend integration target, not as a currently wired production data path.

## 11. Setup and run commands

Prerequisite: Node.js and npm.

```bash
cd backend
npm install
npm run dev
```

The development command uses `tsx watch src/server.ts`. For a one-time run:

```bash
npm run build
npm run start
```

Type verification:

```bash
npm run typecheck
```

## 12. Testing

The backend package has a TypeScript check but no configured automated test runner or test files. Verify current code with:

```bash
cd backend
npm run typecheck
```

Recommended manual API checks:

1. Login with a locally configured test account and retain the returned token.
2. Confirm unauthenticated protected routes return `401`.
3. Confirm a regular user is denied user/task administration.
4. Create a user and a task with a valid assignee.
5. Create a prerequisite and dependent task; confirm `Done` is rejected until the prerequisite is `Done`.
6. Attempt self, missing, and circular dependency inputs.
7. Attempt deletion of a prerequisite with dependents.
8. Restart the server and confirm in-memory data is reset.

## 13. Security limitations

This backend is an exercise implementation, not production authentication.

- Passwords are stored and compared as plain strings.
- Tokens are server-memory identifiers with no expiry, rotation, revocation list beyond logout, or secure cookie attributes.
- There is no rate limiting, HTTPS termination configuration, CSRF strategy, audit log, database encryption, or production logging.
- CORS permits one configured origin but is not a substitute for authentication/authorization.

## 14. Current implementation vs future improvements

### Current implementation

- Express 5 routes mounted at `/api` and `/api/v1`.
- CORS and JSON parsing middleware.
- Zod body validation.
- In-memory users, tasks, and sessions.
- Administrator-only user/task administration.
- Assignment visibility rules, dependency-cycle checks, and completion restriction.

### Future improvements

1. Connect the frontend facade to these HTTP endpoints.
2. Move route handlers into controller/service/repository layers as the codebase grows.
3. Add a database, migrations, persistence, pagination, and indexes.
4. Replace mock passwords/tokens with password hashing, secure cookies or robust signed tokens, expiry, and refresh/revocation policies.
5. Add centralized error middleware, structured logging, rate limits, health endpoint, OpenAPI contract, and automated tests.
6. Add task history to the backend schema if it becomes part of the shared server model.
