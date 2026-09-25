# AI Todo

AI Todo turns a short natural-language prompt into actionable tasks, then helps users organize, complete, and review their personal list.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/ai-todo run typecheck` — typecheck the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — managed PostgreSQL connection string
- Optional env: `OPENAI_API_KEY` — enables provider-backed task generation; the app uses a local planner when it is not configured

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-todo/src/pages/home.tsx` — main todo workspace and interactions
- `artifacts/ai-todo/src/index.css` — visual theme and responsive layout
- `lib/api-spec/openapi.yaml` — API source of truth
- `artifacts/api-server/src/routes/todos.ts` — todo and AI endpoints
- `artifacts/api-server/src/lib/task-planner.ts` — provider-backed planner with local fallback
- `lib/db/src/schema/todos.ts` — todo table and insert model

## Architecture decisions

- AI suggestions are previewed before they are saved, so users stay in control of what enters their list.
- The API supports OpenAI when `OPENAI_API_KEY` is available and falls back to a deterministic local planner so the core workflow remains usable without an external provider.
- Todo state is persisted in PostgreSQL; the client invalidates list and summary queries after every mutation.

## Product

- Prompt-to-task planning with generated suggestions and add-one/add-all controls
- Manual task creation, completion toggles, deletion, status filters, and category filtering
- Completion summary, today count, category progress, loading states, error recovery, and responsive mobile layout

## User preferences

No additional preferences recorded.

## Gotchas

- Regenerate API clients after changing `lib/api-spec/openapi.yaml`.
- The frontend build expects workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for previewing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
