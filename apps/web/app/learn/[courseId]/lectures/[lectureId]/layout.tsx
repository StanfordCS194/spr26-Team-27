import { StudentSessionProvider } from "@/components/in-lecture/StudentSessionContext";
import Topbar from "@/components/in-lecture/Topbar";

export default function StudentLectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentSessionProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar mode="student" />
        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </StudentSessionProvider>
  );
}
