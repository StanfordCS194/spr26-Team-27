"use client";

import { createSession } from "@/lib/actions/instructor";

export function NewSessionForm({ courseId }: { courseId: string }) {
  return (
    <form
      action={createSession}
      className="bg-primary-contr border-divider flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
          Session title
        </span>
        <input
          type="text"
          name="title"
          required
          placeholder="e.g. Lecture 4 — Bayes' Theorem"
          className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="bg-primary-accent hover:bg-primary-accent-dark self-start rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
      >
        Create session
      </button>
    </form>
  );
}
