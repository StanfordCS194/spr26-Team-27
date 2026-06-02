import Link from "next/link";

import { SignupForm } from "@/components/auth/SignupForm";

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
            Students join a class with a course code; teachers spin one up in
            seconds.
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

        <SignupForm defaultCourseSlug={defaultCourseSlug} />

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
