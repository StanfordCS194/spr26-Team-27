import TeachPage from "@/pages/TeachPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/teach/$slug")({
  component: TeachPage,
});
