import Link from "next/link";

import { signIn } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  const errorText = errorMessage(error);
  const infoText = infoMessage(info);

  return (
    <div className="bg-primary-bg flex min-h-full flex-col items-center justify-center p-8">
      <div className="bg-primary-contr border-divider flex w-full max-w-md flex-col gap-6 rounded-2xl border p-8 shadow-sm">
        <Link href="/" className="flex items-center">
          <img
            src="/InLectureLogoWithIcon.svg"
            alt="InLecture"
            className="h-8"
          />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-primary font-display text-title font-semibold">
            Sign in
          </h1>
          <p className="text-secondary text-sm leading-relaxed">
            Your dashboard, bookmarks, and deferred answers follow you across
            devices once you sign in.
          </p>
        </div>

        {infoText && (
          <p
            role="status"
            className="bg-primary-tint text-primary-accent-dark rounded-lg px-3 py-2 text-sm"
          >
            {infoText}
          </p>
        )}
        {errorText && (
          <p
            role="alert"
            className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700"
          >
            {errorText}
          </p>
        )}

        <form action={signIn} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="bg-primary-accent hover:bg-primary-accent-dark mt-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
          >
            Sign in
          </button>
        </form>

        <p className="text-secondary text-center text-sm">
          New here?{" "}
          <Link
            href="/signup"
            className="text-primary-accent-dark font-semibold hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "no_account":
      return "We couldn't find a student account matching your email. Sign up first, or ask your instructor to enroll you.";
    case "not_student":
      return "This account is for instructors. Sign in to the instructor app instead.";
    case "not_instructor":
      return "This account is for students. Sign in to the student app instead.";
    default:
      // Pass-through Supabase Auth errors (e.g. "Invalid login credentials").
      return code;
  }
}

function infoMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "check_email":
      return "Check your inbox to confirm your email, then sign in.";
    default:
      return null;
  }
}
