-- Per-lecture materials: optionally associate a course_material with a
-- session (lecture). NULL = course-wide. On lecture delete the material
-- survives and reverts to course-wide (SET NULL). RAG retrieval stays
-- course-scoped, so no other changes are needed.
--
-- Idempotent.

ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "session_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "course_materials"
    ADD CONSTRAINT "course_materials_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "course_materials_course_session_idx"
  ON "course_materials" ("course_id", "session_id");
