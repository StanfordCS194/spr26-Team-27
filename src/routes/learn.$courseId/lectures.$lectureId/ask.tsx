import AskPage from "@/pages/AskPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/learn/$courseId/lectures/$lectureId/ask",
)({
  component: AskPage,
});
