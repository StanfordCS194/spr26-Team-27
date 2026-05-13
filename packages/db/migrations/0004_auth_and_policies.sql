-- Bridge Supabase Auth (auth.users) into our app's `public.users` directory,
-- and add the RLS SELECT/INSERT policies that gate every student-facing
-- table. Without this migration, sign-up doesn't create a directory row and
-- Supabase Realtime won't deliver any rows to the browser.
--
-- Idempotent: re-running this file should be safe.

-- ---------------------------------------------------------------------------
-- 1. Trigger that mirrors auth.users INSERT into public.users.
--    On email conflict we DO NOTHING so that pre-existing seed rows keep
--    their random UUIDs (existing enrollments stay valid) and the app falls
--    back to email-matching in requireStudent().
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. RLS policies. Authenticated users can:
--    - read their own user row, enrollments, courses, and sessions
--    - read transcript_items / questions / quick_prompt_signals / bookmarks
--      for sessions whose course they're enrolled in
--    - read + insert their own session_participants, questions, bookmarks,
--      quick_prompt_signals (scoped to their participant_id)
--
--    Note: a couple of nested EXISTS subqueries reference auth.uid() inside
--    a SELECT — wrapping in `(SELECT auth.uid())` is a Postgres optimizer
--    hint that lets the planner cache the value per statement.
-- ---------------------------------------------------------------------------

-- users: a signed-in user can read their own row.
DROP POLICY IF EXISTS "users_self_select" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- enrollments: a signed-in user sees their own enrollments.
DROP POLICY IF EXISTS "enrollments_self_select" ON public.enrollments;
CREATE POLICY "enrollments_self_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- courses: a signed-in user sees courses they're enrolled in (students) or
-- own (instructors).
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

-- sessions: visible to anyone who can see the parent course.
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

-- session_participants: a student sees and creates their own row.
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

-- transcript_items: visible to enrolled students + the course's instructor.
-- This is the one realtime depends on — without it, useLiveTranscript won't
-- receive any rows over the WebSocket.
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

-- questions: a student can read + write their own questions (via their
-- session_participants row).
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

-- Instructors can also read every question in a session belonging to their
-- course (so the question feed works).
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

-- bookmarks: students manage their own.
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

-- quick_prompt_signals: students insert their own taps; instructors read
-- everything in their course's sessions (for the confusion gauge).
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
