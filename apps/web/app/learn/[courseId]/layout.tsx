import CourseShell from "@/components/in-lecture/CourseShell";

export default function LearnCourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CourseShell mode="student">{children}</CourseShell>;
}
