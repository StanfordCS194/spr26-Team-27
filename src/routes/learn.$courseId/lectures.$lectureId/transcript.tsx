import TranscriptPage from "@/pages/TranscriptPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/learn/$courseId/lectures/$lectureId/transcript",
)({
  component: TranscriptPage,
});
