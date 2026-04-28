import InLectureLayout from "@/layouts/InLectureLayout";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/learn/$courseId/lectures/$lectureId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: InLectureLayout,
});
