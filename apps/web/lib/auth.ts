import "server-only";

import { users, type User } from "@spr26/db";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// Resolve the currently signed-in Supabase Auth user to a row in our
// internal `public.users` table.
//
// Match priority:
//   1. by id (the trigger in 0004_auth_and_policies mirrors auth.users.id
//      into public.users.id for new sign-ups), then
//   2. by email (covers pre-seeded users whose id was generated before the
//      trigger existed — the seed file inserts random UUIDs).
//
// Redirects to /login whenever no session exists or the user has no
// matching directory row.
export async function requireStudent(): Promise<User> {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    redirect("/login");
  }

  const [student] = await db()
    .select()
    .from(users)
    .where(or(eq(users.id, authUser.id), eq(users.email, authUser.email)))
    .limit(1);

  if (!student) {
    redirect("/login?error=no_account");
  }

  if (student.role !== "student") {
    redirect("/login?error=not_student");
  }

  return student;
}

// Non-redirecting variant for places that just want to know "is the user
// signed in, and if so, who?" (e.g. the landing page CTA, or a header that
// shows different links depending on auth state).
export async function getStudentOrNull(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const [student] = await db()
    .select()
    .from(users)
    .where(or(eq(users.id, authUser.id), eq(users.email, authUser.email)))
    .limit(1);

  return student?.role === "student" ? student : null;
}

export async function requireInstructor(): Promise<User> {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    redirect("/login");
  }

  const [instructor] = await db()
    .select()
    .from(users)
    .where(or(eq(users.id, authUser.id), eq(users.email, authUser.email)))
    .limit(1);

  if (!instructor) {
    redirect("/login?error=no_account");
  }

  if (instructor.role !== "instructor") {
    redirect("/login?error=not_instructor");
  }

  return instructor;
}
