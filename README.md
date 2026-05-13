# InLecture

<p align="center">
  <img src="./InLectureLogo.svg" alt="InLecture - Your favorite class companion" width="680" />
</p>

**Learn More Through Our [Wiki](https://github.com/StanfordCS194/spr26-Team-27/wiki)**

## Repo Layout

This is an npm-workspaces monorepo. One deployable: `@spr26/web` (Next.js 15
App Router) on Vercel, talking to Supabase (Postgres + Auth + Realtime +
Storage).

```
apps/
  web/                        # Next.js 15 app — student + instructor + API
    app/
      page.tsx                # landing
      learn/[courseId]/...    # student route tree
      teach/[courseId]/...    # instructor route tree (record + dashboard)
      api/
        qa/route.ts           # streaming SSE QA
        transcribe/route.ts   # audio chunk → transcript_items insert
        embed/route.ts        # backfill embeddings
    components/
      landing/                # marketing page pieces
      in-lecture/             # shared shell (Sidebar, Topbar, AskPanel...)
      instructor/             # teacher-only (RecordButton, ConfusionGauge...)
      ui/                     # shadcn primitives — run `npx shadcn add <name>`
    lib/
      supabase/{client,server,admin}.ts
      realtime/use*.ts        # postgres_changes hooks
packages/
  ai-service/                 # LLM streaming (Anthropic/OpenAI via Vercel AI SDK)
  db/                         # Drizzle schema + migrations
```

## Stack notes

- **Frontend** — Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui
- **API** — Next.js Route Handlers (Node runtime, SSE streaming)
- **DB** — Supabase Postgres via Drizzle. `pgvector` enabled; `embedding vector(1536)`
  columns on `transcript_items` and `course_material_chunks` (HNSW cosine indexes,
  partial WHERE NOT NULL).
- **Realtime** — Supabase `supabase_realtime` publication covers
  `transcript_items`, `questions`, `answers`, `quick_prompt_signals`,
  `concept_checks`, `concept_check_responses`. Both student and instructor
  clients subscribe via `@supabase/ssr` browser client.
- **Audio** — Browser `MediaRecorder` → 8s WebM chunks → `POST /api/transcribe`
  → Whisper (stubbed) → `transcript_items` insert → Realtime broadcast.
- **Embeddings** — async after insert; OpenAI `text-embedding-3-small`
  (stubbed). RAG over transcript + course material chunks.

## Running locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill in keys
cp packages/db/.env.example packages/db/.env   # then fill in DATABASE_URL
npm run -w @spr26/db db:migrate                # applies migrations 0000-0003
npm run dev                                    # next dev on :3000
```

Required env vars (`apps/web/.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by `/api/transcribe` and `/api/embed`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — at least one, for `/api/qa`

## Deployment (Vercel)

- Single Vercel project on the repo root; `vercel.json` configures
  `buildCommand`, `installCommand`, and route `maxDuration`s.
- Set the env vars above in the Vercel dashboard.

## Who owns what

So we can iterate in parallel without stepping on each other:

| Slice | Owner | Lives in |
| --- | --- | --- |
| DB schema, RLS policies, realtime publication | Zara | `packages/db/{src/schema.ts,migrations/*}` |
| Backend endpoints (qa, transcribe, embed, RAG) | Amrit | `apps/web/app/api/**`, `packages/ai-service/**` |
| Instructor UI (record, live dashboard, concept checks) | Vedant | `apps/web/app/teach/**`, `apps/web/components/instructor/**` |
| Student UI (Ask, transcript, question intake) | Kelly | `apps/web/app/learn/**`, `apps/web/components/in-lecture/**` |
| Landing page / marketing | Kelly | `apps/web/app/page.tsx`, `apps/web/components/landing/**` |

Rules of the road:

- Don't touch files outside your slice without flagging on Slack first.
- `apps/web/lib/realtime/use*.ts` and `apps/web/lib/supabase/*` are shared — if
  you need a new hook, add it; don't fork.
- `packages/ai-service` is a shared package — coordinate API changes.
- Run `npm run format` and `npm run lint` before opening a PR.

## Contributing flow

1. Sync: `git checkout main && git pull --rebase origin main`
2. Branch: `git checkout -b <name>/<short-feature>`
3. Push: `git push -u origin <branch>` and open a PR into `main`
4. Edit-in-flight: `git commit --amend --no-edit && git push -f` on your branch

### Authors

- Kelly Bonilla Guzmán
- Amrit Baveja
- Vedant Singh
- Zara Rutherford
