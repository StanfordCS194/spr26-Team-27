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

// Resolve the directory role for an email so we can route instructors to
// /teach and students to /learn after auth. Defaults to "student" when no
// directory row is found yet (the auth trigger may lag a hair on first login).
async function roleForEmail(email: string): Promise<"student" | "instructor"> {
  const [row] = await db()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.role === "instructor" ? "instructor" : "student";
}

export async function signIn(formData: FormData): Promise<void> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  if (!email || !password) backTo("/login", "Email and password are required.");

  const supabase = await createClient();
  if (!supabase) backTo("/login", "Supabase is not configured on the server.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) backTo("/login", error.message);

  // Route by role so the student and instructor apps stay separate.
  const role = await roleForEmail(email);
  redirect(role === "instructor" ? "/teach" : "/learn");
}

export async function signUp(formData: FormData): Promise<void> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const displayName = field(formData, "display_name").trim();
  const role: "student" | "instructor" =
    field(formData, "role") === "instructor" ? "instructor" : "student";
  // Students join an existing course by code; instructors create one.
  const courseSlug = field(formData, "course_slug")
    .trim()
    .replace(/^\/?(learn\/|teach\/)?/, "")
    .toLowerCase();
  const courseTitle = field(formData, "course_title").trim();

  if (!email || !password)
    backTo("/signup", "Email and password are required.");
  if (password.length < 6)
    backTo("/signup", "Password must be at least 6 characters.");
  if (role === "instructor" && !courseSlug)
    backTo("/signup", "Pick a course code for your class.");

  const supabase = await createClient();
  if (!supabase) backTo("/signup", "Supabase is not configured on the server.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || null,
        role,
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
        role,
        displayName: displayName || null,
      })
      .onConflictDoNothing({ target: users.email });
  }

  // Resolve the directory row requireStudent/requireInstructor will land on
  // (auth id wins; falls back to email-matched seed row).
  const [directoryUser] = authUserId
    ? await db()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    : [];

  if (role === "instructor" && courseSlug && directoryUser) {
    // Create the instructor's course. If the code is taken, bounce back with
    // an error rather than silently attaching them to someone else's course.
    const [existing] = await db()
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);
    if (existing && existing.instructorId !== directoryUser.id) {
      backTo("/signup", `Course code "${courseSlug}" is already taken.`);
    }
    if (!existing) {
      await db()
        .insert(courses)
        .values({
          slug: courseSlug,
          title: courseTitle || courseSlug,
          instructorId: directoryUser.id,
        })
        .onConflictDoNothing({ target: courses.slug });
    }
  } else if (role === "student" && courseSlug && directoryUser) {
    // Enroll the new student so their dashboard isn't empty. Silently no-ops
    // when the slug doesn't exist — we'd rather complete signup than block on
    // a typo.
    const [course] = await db()
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);
    if (course) {
      await db()
        .insert(enrollments)
        .values({ userId: directoryUser.id, courseId: course.id })
        .onConflictDoNothing();
    }
  }

  // Supabase issues a session cookie on signUp (when email confirmation is
  // disabled, which is the default for new projects). If confirmation is ON,
  // the user lands on /login until they confirm.
  const home = role === "instructor" ? "/teach" : "/learn";
  redirect(data.session ? home : "/login?info=check_email");
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
