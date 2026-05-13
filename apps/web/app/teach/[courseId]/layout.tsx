import CourseShell from "@/components/in-lecture/CourseShell";

// TODO(instructor): wire instructor auth + course ownership and fetch real
// sessions for the sidebar. For now the sidebar is empty on the instructor
// side; the student side owns the dashboard work in this PR.
export default async function TeachCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return (
    <CourseShell mode="instructor" courseSlug={courseId} sessions={[]}>
      {children}
    </CourseShell>
  );
}
