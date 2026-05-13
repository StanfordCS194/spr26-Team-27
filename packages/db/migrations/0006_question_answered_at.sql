-- Add answered_at to questions so the instructor's QuestionFeed can mark
-- which student questions have been addressed during lecture. NULL = open;
-- non-null = answered (instructor explicitly marked it, or — in a future
-- pass — auto-resolved when the live answer stream completes).
--
-- Idempotent.

ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "answered_at" timestamp with time zone;
--> statement-breakpoint

-- Instructors mark questions answered: allow UPDATE for the course owner.
DROP POLICY IF EXISTS "questions_instructor_update" ON public.questions;
CREATE POLICY "questions_instructor_update" ON public.questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = questions.session_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = questions.session_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  );
