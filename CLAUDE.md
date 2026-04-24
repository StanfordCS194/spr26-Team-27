# InLecture

## Stack
- Framework: Next.js 14 App Router, TypeScript strict mode
- Styling: Tailwind CSS, no CSS modules
- DB & Auth: Supabase (PostgreSQL + pgvector + Realtime)
- Transcription: Deepgram streaming API
- Deployment: Vercel (auto-deploy on merge to main)

## Architecture
- /app/student/     → student Q&A interface (mobile-first)
- /app/instructor/  → instructor dashboard + session control
- /app/api/         → API routes (RAG pipeline, session lifecycle)
- /lib/supabase/    → Supabase client + typed query helpers
- /lib/rag/         → chunking, embedding, retrieval logic
- /lib/audio/       → Deepgram integration + transcript buffer

## Key constraints
- RAG pipeline (question → retrieval → generation → response) must complete < 5s
- Student questions are anonymous — never store user identity alongside question content
- Audio transcription runs only while instructor session is active (billing concern)
- Supabase Realtime handles live updates — do NOT introduce a separate WebSocket server

## Commands
- Dev:   npm run dev (port 3000)
- Test:  npm run test (Vitest)
- E2E:   npm run test:e2e (Playwright)
- Build: npm run build

## Env vars
- NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
- DEEPGRAM_API_KEY
- ANTHROPIC_API_KEY (for RAG generation step)
- See .env.example for full list — never hardcode

## Gotchas
- pgvector requires the vector extension enabled in Supabase dashboard before any migration
- Deepgram streaming uses WebSocket — runs server-side in an API route, not in browser
- Supabase Realtime channel names must be unique per session (use session_id prefix)
- Next.js App Router: server components cannot use useState/useEffect — keep client 
  components in /components/client/
