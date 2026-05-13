import Topbar from "@/components/in-lecture/Topbar";

export default function InstructorLectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary-bg flex min-h-0 flex-1 flex-col">
      <Topbar mode="instructor" />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
