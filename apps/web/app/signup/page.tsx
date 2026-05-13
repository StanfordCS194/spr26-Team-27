import Link from "next/link";

import { signUp } from "@/lib/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const defaultCourseSlug = process.env.DEMO_COURSE_SLUG ?? "";

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
            Create your account
          </h1>
          <p className="text-secondary text-sm leading-relaxed">
            Already in a class? Enter the course code your instructor gave you
            and we&apos;ll drop you straight into the dashboard.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700"
          >
            {error}
          </p>
        )}

        <form action={signUp} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
              Name
            </span>
            <input
              type="text"
              name="display_name"
              autoComplete="name"
              placeholder="Your name"
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={6}
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
              Course code (optional)
            </span>
            <input
              type="text"
              name="course_slug"
              defaultValue={defaultCourseSlug}
              placeholder="piech109"
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
            <span className="text-secondary text-xs">
              You can also join a course later from your dashboard.
            </span>
          </label>
          <button
            type="submit"
            className="bg-primary-accent hover:bg-primary-accent-dark mt-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
          >
            Create account
          </button>
        </form>

        <p className="text-secondary text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary-accent-dark font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
