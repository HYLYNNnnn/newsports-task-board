# Nextplay

A responsive Kanban workspace built with React, TypeScript, Vite, dnd-kit, and Supabase. Each visitor receives an anonymous account and a private task board.

[中文运行指南](docs/local-guide.zh-CN.md)

## Features

- Four workflow stages: To Do, In Progress, In Review, and Done.
- Create, edit, and delete tasks with descriptions, priorities, due dates, assignees, and multiple custom labels.
- Animated drag-and-drop with a source placeholder, destination highlight, landing feedback, and reduced-motion support.
- Single-click a card to expand its full details; double-click or use the pencil to edit. The comment badge opens a separate conversation panel.
- Team member profiles with colored avatars, chronological comments, and a detailed task activity timeline.
- Search, combined priority/member/label filters, sorting, board/list views, summary statistics, and JSON export.
- Due-today, upcoming, and overdue indicators; completed tasks do not show urgency warnings.
- Responsive layout, touch and keyboard interactions, focus-managed dialogs, and explicit loading, empty, and error states.

The design pairs a light sidebar with a violet primary action and blue, orange, purple, and green workflow stages. Strong typography and priority badges make the main actions and urgent work easy to scan.

## Run locally

Use Node.js 22.12 or later and pnpm.

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:5173>. With both Supabase variables absent, the app runs as an explicitly labeled local demo with ten sample tasks. Demo data stays in that browser; it is not uploaded when cloud mode is enabled.

```sh
pnpm build     # TypeScript checks and production build in dist/
pnpm preview   # Preview the production build on port 4173
```

The optional `start.command` launcher supports macOS and uses an existing local Node installation when available.

## Connect Supabase

1. Create a Supabase project and execute [supabase/schema.sql](supabase/schema.sql) in its SQL Editor.
2. Enable **Anonymous Sign-Ins** in Supabase Authentication.
3. Copy `.env.example` to `.env` and fill in the project URL and publishable/anon key:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

4. Restart the development server. The app should display **Cloud workspace** and **Connected to Supabase**.

New cloud visitors start with an empty board. Anonymous identity is tied to the browser session; clearing site storage or changing devices creates a different workspace.

For a database created with an earlier schema, use [the incremental migration](supabase/migrations/20261112_advanced_features.sql). It preserves existing tasks, comments, and history. Default label initialization is idempotent and preserves existing names and colors, including case variants and concurrent first loads.

Incomplete configuration, authentication failures, and database errors remain visible. They do not silently fall back to local storage.

## Database and access

The schema contains five owner-scoped tables: `tasks`, `team_members`, `comments`, `task_activities`, and `labels`. All have Row Level Security. Anonymous users use Supabase's `authenticated` role; policies restrict rows to `auth.uid() = user_id`.

Composite foreign keys prevent comments and assignee references from crossing workspace boundaries. Label validation restricts tasks to the owner's labels. Database triggers write individual activity events for changed fields; the client can only read that activity. Deleting a task cascades to its comments and timeline.

Only a publishable/anon key belongs in the frontend. Keep `.env` out of version control and never use a service-role or secret key in browser code.

## Verification

```sh
pnpm test:repository  # Label initialization, concurrent loads, and error recovery
pnpm test:db          # PostgreSQL schema, migrations, RLS, ownership, and triggers
pnpm test:e2e         # 21 browser scenarios using locally installed Google Chrome
pnpm test            # Repository, database, then browser checks
```

Browser tests expect the local demo and its sample data. Run them against an independent development service with both Supabase variables empty; the current browser configuration uses port 5173 and may reuse an existing server. Do not point them at a cloud workspace.

With cloud configuration present, `pnpm test:cloud` exercises two anonymous accounts to verify persistence, ownership, and cross-user restrictions. It creates temporary cloud records and removes its test tasks; anonymous accounts and test labels remain. Local PostgreSQL tests use a simulated `auth.uid()` and do not replace a real cloud check.

See [the verification record](docs/verification.md) for completed checks and their limits.

## Deploy on Vercel

Import this repository into Vercel. [vercel.json](vercel.json) configures Vite, `pnpm install --frozen-lockfile`, `pnpm build`, and the `dist` output directory.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel before deploying. Vite embeds these public configuration values at build time; changing them requires a new deployment. Verify the production URL in a normal and private browser session, including refresh persistence and separate guest workspaces.

## Structure

```text
src/components/        Board, task details/editor, discussion, labels, dialogs
src/lib/repository.ts  Local and Supabase persistence adapters
src/lib/seed.ts        Browser-local demo data
src/lib/utils.ts       Date formatting and activity helpers
src/types.ts           Shared task and workspace types
src/styles.css        Layout and responsive styles
src/theme.css         Color, visual hierarchy, and drag animation
supabase/             Complete schema and incremental migration
tests/                Repository, PostgreSQL, browser, and cloud checks
public/fonts/         Local fonts and their licenses
```

## Tradeoffs and future improvements

Team members are assignee profiles within one visitor's workspace, rather than invited collaborators. Each task has one assignee. Labels can be created but cannot yet be renamed or deleted. Tasks support cross-column dragging; manual ordering within a column is not persisted.

Cloud data refreshes on load, save, drop, and manual refresh. Realtime subscriptions, shared workspaces, recoverable accounts, label editing, and conflict-aware collaborative updates would be useful next steps.

Fonts are self-hosted DM Sans and Manrope; their licenses are included in `public/fonts`.
