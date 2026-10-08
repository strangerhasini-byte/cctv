# VisionGuard AI

A private security-review workspace for organizing CCTV recordings and checking timestamped activity findings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/visionguard-ai run typecheck` — check the web artifact
- Required environment is supplied through the Replit workspace: database connection, session signing, OIDC identity, and private object storage.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/visionguard-ai/src/App.tsx` — routed review workspace and user-facing flows
- `artifacts/visionguard-ai/src/index.css` and `src/session.css` — visual system and sign-in styling
- `artifacts/api-server/src/routes/visionguard.ts` — owner-scoped evidence, dashboard, investigations, alerts, reports, and upload registration
- `artifacts/api-server/src/routes/storage.ts` — signed uploads and owner-checked private video reads
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/visionguard.ts` — VisionGuard PostgreSQL schema

## Architecture decisions

- Every VisionGuard data query is scoped to the authenticated user's ID; stored video objects are readable only after they are registered to that same user.
- First-time accounts receive clearly labeled sample records to make the review interface usable without claiming that the uploaded footage was analyzed.
- New uploads are private source files; automated computer-vision processing is not connected, so an upload must not be presented as analyzed.
- Evidence search and Ask Evidence currently match stored event descriptions. No generative model or video-understanding service is connected.

## Product

The workspace provides a dashboard, private video library and upload flow, timestamped event review, anonymous track summaries, investigations, text evidence search, evidence-bounded Q&A, alert rules, reports, analytics, and review settings. Findings are candidates for human verification, not proof of identity, intent, or wrongdoing.

## User preferences

- Keep footage and review data confidential; do not make CCTV objects publicly accessible.
- Clearly distinguish observations, model estimates, sample data, and human-confirmed conclusions. Never infer identity from appearance.

## Gotchas

- API hooks and runtime validation are generated from `lib/api-spec/openapi.yaml`; regenerate them after contract changes.
- The sample dataset is seeded once per user, when their VisionGuard video library is first accessed.
- Evidence Q&A is currently deterministic text matching and must not be described as generative AI.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
