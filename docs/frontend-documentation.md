# Frontend Documentation

## 1. Scope and current architecture

The frontend is a Next.js App Router application written in TypeScript. It is a **client-side, local-first implementation**: pages and components call `lib/api.ts`, which forwards operations to `lib/storage.ts`; that service reads and writes browser `localStorage`.

```text
Page → reusable component → lib/api.ts → lib/storage.ts → localStorage
                         ↑
                 TypeScript domain types
```

### Design decisions

| Decision | What it does | Why it was chosen | Trade-off |
| --- | --- | --- | --- |
| Storage service | Keeps local-storage reads, writes, validation, permission rules, history, and seed logic in `lib/storage.ts`. | React components stay focused on interaction and presentation. | State is local to a browser. |
| Async facade | Wraps local operations in promises in `lib/api.ts`. | Components can later call a remote implementation without changing their calling pattern. | It is not a live network API today. |
| Shared layout/components | Sidebar, modal, task card, task form, and footer are reused. | Navigation and task behavior stay consistent across pages. | Shared components accept several props. |
| Type unions | Priority, status, role, task, user, and session shapes are in `types.ts`. | Invalid values are caught during TypeScript checks. | Runtime validation is still needed at boundaries. |

## 2. Folder structure

```text
frontend/
├── app/
│   ├── page.tsx                # Public landing page
│   ├── layout.tsx              # Global document layout and metadata
│   ├── globals.css             # Tailwind import and shared style primitives
│   ├── login/page.tsx          # Login screen
│   ├── dashboard/page.tsx      # Metrics and recent tasks
│   ├── tasks/page.tsx          # All, My, and Blocked task views
│   └── users/page.tsx          # Administrator user directory/creation
├── components/
│   ├── Sidebar.tsx             # Authenticated layout and responsive navigation
│   ├── TaskCard.tsx            # Task summary, status control, edit/delete controls
│   ├── TaskForm.tsx            # Create/edit task form
│   ├── Modal.tsx               # Reusable dismissible dialog
│   └── Footer.tsx              # Shared workspace footer
├── lib/
│   ├── api.ts                  # Promise-shaped data facade
│   └── storage.ts              # localStorage repository and business rules
├── public/                     # Static assets
├── types.ts                    # Frontend domain types
└── package.json
```

## 3. Pages and routes

| Route | Page | Access | Behavior |
| --- | --- | --- | --- |
| `/` | Landing page | Public | Introduces the app and links to login. |
| `/login` | Login | Public | Authenticates against locally stored users and redirects to Dashboard. |
| `/dashboard` | Dashboard | Signed-in user | Shows role-scoped task metrics and recent visible tasks. |
| `/tasks?view=mine` | My Tasks | Signed-in user | Shows tasks assigned to the signed-in user. |
| `/tasks?view=all` | All Tasks | Administrator navigation | Shows all accessible tasks; exposes create/edit/delete actions to administrators. |
| `/tasks?view=blocked` | Blocked Tasks | Administrator navigation | Locally filters to unfinished tasks with unfinished dependencies. |
| `/users` | Users | Administrator | Lists users and opens the Create User dialog. |

The `Sidebar` checks for a saved session and redirects missing sessions to `/login`. Role-based navigation hides administrator-only links from regular users. The storage service remains the enforcement point for task and user mutations.

## 4. Reusable components

| Component | Responsibility | Why it exists |
| --- | --- | --- |
| `Sidebar` | Authenticated shell, desktop sidebar, mobile drawer, active link, New Task action, sign out. | Prevents each page from rebuilding navigation and role checks. |
| `TaskCard` | Displays task details, block warning, status selection, and optional edit/delete controls. | Gives Dashboard and Tasks the same task presentation. |
| `TaskForm` | Collects title, description, priority, status, assignee, and dependency selection. | One form handles both create and edit cases. |
| `Modal` | Renders an overlay dialog, close button, backdrop close, and Escape-key close. | Reuses accessible dialog semantics for task/user forms. |
| `Footer` | Renders the workspace footer. | Keeps authenticated screens visually consistent. |

## 5. State management and data flow

No external state-management library is used. Components use React `useState`, `useEffect`, `useMemo`, and `useCallback` for view state, loading data, filtering, and reload callbacks. Durable domain data is in `localStorage`; in-memory React state is refreshed after mutations.

```text
User action
  │
  ├─ Login / user / task call
  ▼
api.ts returns Promise<T>
  ▼
storage.ts checks session, role, input, and dependencies
  ├─ writes localStorage
  └─ returns data or throws Error
  ▼
page reload callback updates React state
  ▼
TaskCard / dashboard / filtered list rerenders
```

`storage.ts` owns three browser keys: users, tasks, and session. It seeds the administrator only when the users key is absent and preserves existing data. User objects exposed to components omit password values.

## 6. Forms and validation

### Login

The Login page uses required email and password fields. It calls `api.auth.login`, stores the resulting session, and redirects to `/dashboard`. Invalid credentials are rendered as a short error message.

### Create user

The Users page provides the administrator-only Create User dialog. Browser validation requires values and a six-character minimum password. The storage service also trims the name, normalizes email casing, rejects empty names, duplicate emails, and short passwords. New accounts receive the `user` role.

### Create/edit task

`TaskForm` is used for both actions. It initializes its state from an optional task and sends a `TaskInput` containing:

```ts
{
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  status: "To Do" | "In Progress" | "Done";
  assignedTo: string | null;
  dependencies: string[];
}
```

The form omits the edited task itself from the dependency choices. The storage service is the final validation layer: it verifies an assignee exists, normalizes duplicate dependency IDs, rejects missing/self/cyclic dependencies, and rejects a blocked task becoming `Done`.

## 7. Task flows

### Create or update

```text
Administrator clicks New Task or Edit
  → TaskForm collects values
  → api.tasks.create/update
  → storage validates permissions, assignee, dependency graph, completion rule
  → storage writes the task and history entry
  → modal closes and task list reloads
```

### Delete

An administrator confirms deletion in the browser. `taskStore.remove` rejects the action when any remaining task depends on the selected task; otherwise it removes it from local storage.

### Status change

The task card exposes a status selector. Administrators can change any visible task. A regular user can change only a task assigned to them. `Done` is disabled in the selector for a visibly blocked task and storage checks again before persisting. Updates append an entry to the frontend task history and refresh `updatedAt`.

### Assignment and dependency UI

The assignee selector lists all users for an administrator. `Unassigned` maps to `null`. The dependency UI is a scrollable checklist; each selected prerequisite prevents completion until it is `Done`. A blocked card shows the titles of unfinished known dependencies.

## 8. Task views, filters, and display states

`tasks/page.tsx` loads tasks and, for administrators, users. It derives the visible set in `useMemo`:

| View | Selection rule |
| --- | --- |
| All Tasks | No view-level restriction. |
| My Tasks | `assignedTo` equals the signed-in user's ID. |
| Blocked Tasks | Task is not `Done` and at least one dependency is not `Done`. |

Search matches the task title case-insensitively. Status and priority selects further narrow the result. The pages include:

- A loading message while Dashboard data is being loaded.
- Inline errors when an operation fails.
- Empty-state cards when no tasks match or no task exists.
- Browser alerts for status/delete failures.

## 9. Navigation and responsive design

The authenticated shell changes at the Tailwind `lg` breakpoint:

```text
Small / tablet screen                 Desktop (lg and above)
────────────────────                 ──────────────────────
Header menu button                    Fixed visible sidebar
Overlay drawer navigation             Two-column app shell
Content uses 4px/6px padding          Content uses larger padding
```

Other responsive decisions:

- Global CSS sets `min-width: 320px` and prevents horizontal overflow.
- Landing-page typography and controls are smaller on mobile and scale up with `sm` and `lg` utilities.
- Dashboard metrics and Users cards progressively move from one column to two, three, or five columns where configured.
- Task filter controls become a three-column layout from the medium breakpoint.
- The task form becomes two columns from the small breakpoint.
- The modal is bottom-aligned on small screens and centered at the small breakpoint; its content scrolls within 90vh.

## 10. API communication boundary

`lib/api.ts` exposes `auth`, `users`, `dashboard`, and `tasks` methods. It intentionally mirrors a typical remote API shape by returning promises. In the current source, every method delegates to `sessionStore`, `userStore`, `taskStore`, or `storageHelpers`; it does not use `fetch`, an API URL, or the Express server.

This is a deliberate migration seam: a future adapter can make the same methods call the Express routes while pages/components remain unchanged. The backend API contract is documented separately in [backend-api-documentation.md](backend-api-documentation.md).

## 11. Current implementation vs future improvements

### Current implementation

- Browser-persisted local user/task/session data.
- Frontend-only task history entries.
- Promise-shaped service facade.
- Client-side role guards plus storage-level permission checks.
- Mobile, tablet, and desktop layouts using Tailwind utilities.

### Future improvements

- Replace local facade calls with HTTP calls and synchronize state across users/devices.
- Add a React context or server-state library only if application state becomes more complex.
- Add form-level schema validation with better field-specific messages.
- Add visible task history, optimistic UI, toasts, focus trapping, and automated component/end-to-end tests.
- Improve storage-event handling for multiple tabs and use secure server-side authentication.

## 12. Frontend commands

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```
