-- Sliding-window chunks of transcript_items for RAG retrieval. Added when
-- Amrit's RAG work landed (transcript_chunks table in packages/db/src/schema.ts).
-- Mirrors the schema definition and enables RLS with a SELECT policy that
-- matches the parent transcript_items policy (enrolled students + the course's
-- instructor).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS "transcript_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "start_seq" integer NOT NULL,
  "end_seq" integer NOT NULL,
  "start_timestamp_seconds" integer NOT NULL,
  "end_timestamp_seconds" integer NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "transcript_chunks_seq_order" CHECK ("end_seq" >= "start_seq"),
  CONSTRAINT "transcript_chunks_session_start_unique" UNIQUE ("session_id", "start_seq")
);
--> statement-breakpoint

ALTER TABLE "transcript_chunks"
  ADD CONSTRAINT IF NOT EXISTS "transcript_chunks_session_id_sessions_id_fk"
  FOREIGN KEY ("session_id")
  REFERENCES "public"."sessions"("id")
  ON DELETE cascade;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transcript_chunks_session_end_idx"
  ON "transcript_chunks" ("session_id", "end_seq");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transcript_chunks_embedding_idx"
  ON "transcript_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "transcript_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "transcript_chunks_enrolled_select" ON public.transcript_chunks;
CREATE POLICY "transcript_chunks_enrolled_select" ON public.transcript_chunks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = transcript_chunks.session_id
        AND (
          c.instructor_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id
              AND e.user_id = (SELECT auth.uid())
          )
        )
    )
  );
