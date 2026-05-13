"use client";

import Sidebar from "@/components/in-lecture/Sidebar";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/in-lecture/SidebarContext";
import { usePathname } from "next/navigation";

type Mode = "student" | "instructor";

function ShellInner({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useSidebar();
  const pathname = usePathname();
  const root = mode === "student" ? "learn" : "teach";
  // Course index = /(learn|teach)/[courseId] with no /lectures/... suffix.
  const isAtCourseIndex = !!pathname?.match(new RegExp(`^/${root}/[^/]+/?$`));

  return (
    <div className="flex h-full">
      {isAtCourseIndex && (
        <div className="flex flex-1 flex-col sm:hidden">
          <Sidebar mode={mode} />
        </div>
      )}

      {sidebarOpen && (
        <div className="w-sidebar border-divider hidden shrink-0 border-r sm:flex sm:flex-col">
          <Sidebar mode={mode} />
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

export default function CourseShell({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ShellInner mode={mode}>{children}</ShellInner>
    </SidebarProvider>
  );
}
