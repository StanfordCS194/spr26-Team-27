-- Course-material ingestion: parse uploaded files (LlamaParse) into
-- contextualized, embedded chunks for hybrid (vector + FTS) RAG retrieval.
--
-- Adds an ingestion lifecycle to `course_materials`, and to
-- `course_material_chunks` adds the Contextual-Retrieval `context` blurb plus
-- a generated `fts` tsvector (over context + content) with a GIN index so the
-- search_course_materials tool can fuse lexical and vector hits.
--
-- Idempotent: re-running this file is safe.

-- ---------------------------------------------------------------------------
-- 1. course_materials: ingestion status / error / page count.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."course_material_status" AS ENUM ('pending', 'parsing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

ALTER TABLE "course_materials"
  ADD COLUMN IF NOT EXISTS "status" "public"."course_material_status" NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "error" text;
--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "page_count" integer;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. course_material_chunks: contextual blurb + generated FTS tsvector.
-- ---------------------------------------------------------------------------

ALTER TABLE "course_material_chunks" ADD COLUMN IF NOT EXISTS "context" text;
--> statement-breakpoint

ALTER TABLE "course_material_chunks"
  ADD COLUMN IF NOT EXISTS "fts" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("context", '') || ' ' || "content")
  ) STORED;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "course_material_chunks_fts_idx"
  ON "course_material_chunks" USING gin ("fts");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. RLS. Materials + chunks are readable by enrolled students and the
--    course's instructor (mirrors transcript_chunks_enrolled_select); only
--    the owning instructor can write. App routes use the Drizzle service
--    connection and bypass RLS — these policies gate browser/Realtime access.
-- ---------------------------------------------------------------------------

ALTER TABLE "course_materials" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "course_material_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "course_materials_member_select" ON public.course_materials;
CREATE POLICY "course_materials_member_select" ON public.course_materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_materials.course_id
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
--> statement-breakpoint

DROP POLICY IF EXISTS "course_materials_instructor_write" ON public.course_materials;
CREATE POLICY "course_materials_instructor_write" ON public.course_materials
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_materials.course_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_materials.course_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  );
--> statement-breakpoint

DROP POLICY IF EXISTS "course_material_chunks_member_select" ON public.course_material_chunks;
CREATE POLICY "course_material_chunks_member_select" ON public.course_material_chunks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_materials m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = course_material_chunks.course_material_id
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
--> statement-breakpoint

DROP POLICY IF EXISTS "course_material_chunks_instructor_write" ON public.course_material_chunks;
CREATE POLICY "course_material_chunks_instructor_write" ON public.course_material_chunks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_materials m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = course_material_chunks.course_material_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_materials m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = course_material_chunks.course_material_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  );
