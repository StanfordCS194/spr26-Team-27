import CourseShell from "@/components/in-lecture/CourseShell";

export default function TeachCourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CourseShell mode="instructor">{children}</CourseShell>;
}
