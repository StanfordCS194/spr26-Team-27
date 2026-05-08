import InstructorSessionPage from "@/pages/InstructorSessionPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/instructor/session/$sessionId")({
  component: InstructorSessionPage,
});
