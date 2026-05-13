"use client";

import Sidebar, { type SidebarSession } from "@/components/in-lecture/Sidebar";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/in-lecture/SidebarContext";
import { usePathname } from "next/navigation";

type Mode = "student" | "instructor";

interface Props {
  mode: Mode;
  courseSlug: string;
  sessions: readonly SidebarSession[];
  children: React.ReactNode;
}

function ShellInner({ mode, courseSlug, sessions, children }: Props) {
  const { sidebarOpen } = useSidebar();
  const pathname = usePathname();
  const root = mode === "student" ? "learn" : "teach";
  // Course index = /(learn|teach)/[courseId] with no /lectures/... suffix.
  const isAtCourseIndex = new RegExp(`^/${root}/[^/]+/?$`).test(pathname ?? "");

  return (
    <div className="flex h-full">
      {isAtCourseIndex && (
        <div className="flex flex-1 flex-col sm:hidden">
          <Sidebar mode={mode} courseSlug={courseSlug} sessions={sessions} />
        </div>
      )}

      {sidebarOpen && (
        <div className="w-sidebar border-divider hidden shrink-0 border-r sm:flex sm:flex-col">
          <Sidebar mode={mode} courseSlug={courseSlug} sessions={sessions} />
        </div>
      )}
      <div
        className={
          isAtCourseIndex
            ? "hidden min-w-0 flex-1 flex-col sm:flex"
            : "flex min-w-0 flex-1 flex-col"
        }
      >
        {children}
      </div>
    </div>
  );
}

export default function CourseShell(props: Props) {
  return (
    <SidebarProvider>
      <ShellInner {...props} />
    </SidebarProvider>
  );
}
