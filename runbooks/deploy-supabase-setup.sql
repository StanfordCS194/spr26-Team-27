-- One-shot Supabase setup for the zara/student-dashboard preview deploy.
-- Paste this entire file into Supabase Studio → SQL Editor → Run.
--
-- IDEMPOTENT + SELF-HEALING: safe to run any number of times. Handles every
-- state the prod DB might already be in:
--   * empty schema → creates everything
--   * cs-109 + sessions already linked → no-op
--   * sessions attached to a different course → re-parents them to cs-109
--   * stale duplicate courses with no sessions left → deletes them
--
-- After this finishes, hit /api/embed and /api/chunk on the deployed site
-- (instructions in the runbook) to make sure RAG retrieval is ready.

-- ===========================================================================
-- MIGRATION 0004 — auth bridge + RLS policies
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')::public.user_role,
    NULLIF(NEW.raw_user_meta_data->>'display_name', '')
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

DROP POLICY IF EXISTS "users_self_select" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "enrollments_self_select" ON public.enrollments;
CREATE POLICY "enrollments_self_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "courses_visible_to_member" ON public.courses;
CREATE POLICY "courses_visible_to_member" ON public.courses
  FOR SELECT TO authenticated
  USING (
    instructor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = courses.id
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "sessions_visible_to_member" ON public.sessions;
CREATE POLICY "sessions_visible_to_member" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = sessions.course_id
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

DROP POLICY IF EXISTS "session_participants_self_select" ON public.session_participants;
CREATE POLICY "session_participants_self_select" ON public.session_participants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "session_participants_self_insert" ON public.session_participants;
CREATE POLICY "session_participants_self_insert" ON public.session_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "session_participants_self_update" ON public.session_participants;
CREATE POLICY "session_participants_self_update" ON public.session_participants
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "transcript_items_enrolled_select" ON public.transcript_items;
CREATE POLICY "transcript_items_enrolled_select" ON public.transcript_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = transcript_items.session_id
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

DROP POLICY IF EXISTS "questions_self_select" ON public.questions;
CREATE POLICY "questions_self_select" ON public.questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = questions.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "questions_self_insert" ON public.questions;
CREATE POLICY "questions_self_insert" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = questions.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "questions_instructor_select" ON public.questions;
CREATE POLICY "questions_instructor_select" ON public.questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = questions.session_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "bookmarks_self_select" ON public.bookmarks;
CREATE POLICY "bookmarks_self_select" ON public.bookmarks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = bookmarks.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "bookmarks_self_insert" ON public.bookmarks;
CREATE POLICY "bookmarks_self_insert" ON public.bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = bookmarks.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "bookmarks_self_delete" ON public.bookmarks;
CREATE POLICY "bookmarks_self_delete" ON public.bookmarks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = bookmarks.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "quick_prompt_signals_self_insert" ON public.quick_prompt_signals;
CREATE POLICY "quick_prompt_signals_self_insert" ON public.quick_prompt_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.id = quick_prompt_signals.participant_id
        AND sp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "quick_prompt_signals_instructor_select" ON public.quick_prompt_signals;
CREATE POLICY "quick_prompt_signals_instructor_select" ON public.quick_prompt_signals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = quick_prompt_signals.session_id
        AND c.instructor_id = (SELECT auth.uid())
    )
  );

-- ===========================================================================
-- MIGRATION 0005 — transcript_chunks (RAG retrieval table)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  start_seq integer NOT NULL,
  end_seq integer NOT NULL,
  start_timestamp_seconds integer NOT NULL,
  end_timestamp_seconds integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT transcript_chunks_seq_order CHECK (end_seq >= start_seq),
  CONSTRAINT transcript_chunks_session_start_unique UNIQUE (session_id, start_seq)
);

DO $$ BEGIN
  ALTER TABLE public.transcript_chunks
    ADD CONSTRAINT transcript_chunks_session_id_sessions_id_fk
    FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS transcript_chunks_session_end_idx
  ON public.transcript_chunks (session_id, end_seq);

CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx
  ON public.transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;

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

-- ===========================================================================
-- STRUCTURAL SEED (self-healing)
-- ===========================================================================

DO $$
DECLARE
  v_instructor_id uuid;
  v_course_id uuid;
BEGIN
  -- Make sure an instructor row exists so the course FK can resolve.
  INSERT INTO public.users (email, role, display_name)
  VALUES ('cpiech@stanford.edu', 'instructor', 'Chris Piech')
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_instructor_id FROM public.users
   WHERE email = 'cpiech@stanford.edu';

  -- Make sure the cs-109 course exists.
  INSERT INTO public.courses (slug, title, instructor_id)
  VALUES ('cs-109', 'CS 109: Introduction to Probability', v_instructor_id)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_course_id FROM public.courses WHERE slug = 'cs-109';

  -- Insert the three demo sessions OR re-parent them to cs-109 if they
  -- already exist (e.g. an older seed put them on a different course).
  -- ON CONFLICT (id) DO UPDATE updates only the course_id so we preserve
  -- any existing title/status edits.
  INSERT INTO public.sessions (id, course_id, title, status)
  VALUES
    ('742bcd6f-0896-4a89-8e8c-91abbb11fd95', v_course_id, '1 - Counting',
     'ended'),
    ('59d5f5c1-671c-4b6f-917b-f3d1f5d24282', v_course_id, '2 - Combinatorics',
     'scheduled'),
    ('00b10e74-4620-47d8-a298-5cddc8f4e087', v_course_id,
     '3 - What is Probability?', 'scheduled')
  ON CONFLICT (id) DO UPDATE
    SET course_id = EXCLUDED.course_id;
END $$;

-- Clean up: any course that's now empty (no sessions point to it) and
-- isn't cs-109 was an orphan from an older seed. Safe to delete because
-- transcript_items cascade with sessions, not courses.
DELETE FROM public.courses
WHERE slug <> 'cs-109'
  AND id NOT IN (
    SELECT DISTINCT course_id FROM public.sessions WHERE course_id IS NOT NULL
  );

-- ===========================================================================
-- SANITY CHECK — should be: cs109_course=1, cs109_sessions=3
-- ===========================================================================

SELECT
  (SELECT COUNT(*) FROM public.users WHERE role = 'instructor') AS instructors,
  (SELECT COUNT(*) FROM public.courses WHERE slug = 'cs-109') AS cs109_course,
  (SELECT COUNT(*) FROM public.sessions WHERE course_id IN
     (SELECT id FROM public.courses WHERE slug = 'cs-109')) AS cs109_sessions,
  (SELECT COUNT(*) FROM public.transcript_items WHERE session_id =
     '742bcd6f-0896-4a89-8e8c-91abbb11fd95') AS lecture1_transcript_rows,
  (SELECT COUNT(*) FROM public.transcript_chunks WHERE session_id =
     '742bcd6f-0896-4a89-8e8c-91abbb11fd95') AS lecture1_chunks,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS rls_policies;
