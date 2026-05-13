import Topbar from "@/components/in-lecture/Topbar";

// TODO(instructor): fetch the real session and pass its title + status. The
// student layout does this server-side via getSessionForStudent; the
// instructor app needs its own auth gate before it can do the same.
export default async function InstructorLectureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId } = await params;
  return (
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col">
      <Topbar
        mode="instructor"
        courseSlug={courseId}
        sessionTitle="Lecture"
        sessionStatus="scheduled"
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
