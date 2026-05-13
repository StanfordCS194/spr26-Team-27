"use server";

import { courses, enrollments, users } from "@spr26/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

function backTo(path: "/login" | "/signup", error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

// Narrow FormData reads to string. The input is `FormDataEntryValue | null`
// (i.e. string | File | null); File would never be expected here, but the
// lint rule rightly wants an explicit narrow.
function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function signIn(formData: FormData): Promise<void> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  if (!email || !password) backTo("/login", "Email and password are required.");

  const supabase = await createClient();
  if (!supabase) backTo("/login", "Supabase is not configured on the server.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) backTo("/login", error.message);

  redirect("/learn");
}

export async function signUp(formData: FormData): Promise<void> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const displayName = field(formData, "display_name").trim();
  const courseSlug = field(formData, "course_slug").trim();

  if (!email || !password)
    backTo("/signup", "Email and password are required.");
  if (password.length < 6)
    backTo("/signup", "Password must be at least 6 characters.");

  const supabase = await createClient();
  if (!supabase) backTo("/signup", "Supabase is not configured on the server.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || null,
        role: "student",
      },
    },
  });

  if (error) backTo("/signup", error.message);

  // Belt-and-suspenders: if the auth trigger hasn't synced yet (e.g. running
  // against a dev DB without 0004 applied), insert a public.users row
  // ourselves. ON CONFLICT keeps it idempotent.
  const authUserId = data.user?.id;
  if (authUserId) {
    await db()
      .insert(users)
      .values({
        id: authUserId,
        email,
        role: "student",
        displayName: displayName || null,
      })
      .onConflictDoNothing({ target: users.email });
  }

  // If a course code was provided, enroll the new user in it right away so
  // their dashboard isn't empty on first load. Silently no-ops when the slug
  // doesn't exist — we'd rather complete signup than block on a typo.
  if (courseSlug && authUserId) {
    const [course] = await db()
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (course) {
      // Find the directory row that requireStudent will resolve to (auth id
      // wins; falls back to email-matched seed row).
      const [directoryUser] = await db()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (directoryUser) {
        await db()
          .insert(enrollments)
          .values({ userId: directoryUser.id, courseId: course.id })
          .onConflictDoNothing();
      }
    }
  }

  // Supabase issues a session cookie on signUp (when email confirmation is
  // disabled, which is the default for new projects). If confirmation is
  // ON, the user lands on /login until they confirm.
  redirect(data.session ? "/learn" : "/login?info=check_email");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}

// Enroll the currently-signed-in student in a course identified by its
// slug. Used from the empty-state form on the dashboard so a new account
// can self-join the course their professor told them about (mirrors PRD
// Feature 1's persistent course link).
export async function joinCourseBySlug(formData: FormData): Promise<void> {
  const raw = field(formData, "course_slug").trim();
  if (!raw) redirect("/learn?error=missing_slug");

  const slug = raw.replace(/^\/?(learn\/)?/, "").toLowerCase();

  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) redirect("/login");

  const [course] = await db()
    .select({ id: courses.id, slug: courses.slug })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course) {
    redirect(`/learn?error=unknown_course&slug=${encodeURIComponent(slug)}`);
  }

  // Resolve the directory user (handles both trigger-mirrored and seeded
  // rows — same logic as requireStudent).
  const [directoryUser] = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, authUser.email))
    .limit(1);

  if (!directoryUser) redirect("/login?error=no_account");

  // Check before insert so a duplicate enroll attempt doesn't surface as a
  // unique-constraint error to the user.
  const [existing] = await db()
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, directoryUser.id),
        eq(enrollments.courseId, course.id),
      ),
    )
    .limit(1);

  if (!existing) {
    await db().insert(enrollments).values({
      userId: directoryUser.id,
      courseId: course.id,
    });
  }

  redirect(`/learn/${course.slug}`);
}
