import SelectLecturePage from "@/pages/SelectLecturePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/learn/$courseId/")({
  component: SelectLecturePage,
});
