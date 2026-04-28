import CourseLayout from "@/layouts/CourseLayout";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/learn/$courseId")({
  component: CourseLayout,
});
