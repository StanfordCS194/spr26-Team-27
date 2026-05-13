import { MdArrowForward } from "react-icons/md";

import { joinCourseBySlug } from "@/lib/actions/auth";

interface Props {
  defaultSlug?: string;
  message?: string | null;
}

export function JoinCourseForm({ defaultSlug, message }: Props) {
  return (
    <form
      action={joinCourseBySlug}
      className="bg-primary-contr border-divider flex flex-col gap-3 rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-primary text-base font-semibold">Join a course</h3>
        <p className="text-secondary text-sm">
          Got a course code from your professor? Enter it here.
        </p>
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700"
        >
          {message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          name="course_slug"
          required
          defaultValue={defaultSlug}
          placeholder="e.g. piech109"
          className="border-divider focus:outline-primary-accent flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-primary-accent hover:bg-primary-accent-dark flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
        >
          Join
          <MdArrowForward className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
