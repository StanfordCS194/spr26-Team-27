import InstructorDashboardPage from "@/pages/InstructorDashboardPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/instructor/")({
  component: InstructorDashboardPage,
});
