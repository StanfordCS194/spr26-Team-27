import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/learn/$courseId/lectures/$lectureId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/learn/$courseId/lectures/$lectureId/ask",
      params,
    });
  },
});
