import Sidebar from "@/components/inLecture/Sidebar";
import SidebarProvider from "@/contexts/SidebarContext";
import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";

function CourseLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const matchRoute = useMatchRoute();
  const isAtCourseIndex = matchRoute({ to: "/learn/$courseId" });

  return (
    <SidebarProvider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="flex h-full">
        {/* Mobile: full-width sidebar, only at the course index (no lecture selected) */}
        {isAtCourseIndex && (
          <div className="flex flex-1 flex-col sm:hidden">
            <Sidebar />
          </div>
        )}

        {/* Desktop: collapsible sidebar panel */}
        {sidebarOpen && (
          <div className="w-sidebar border-divider hidden shrink-0 border-r sm:flex sm:flex-col">
            <Sidebar />
          </div>
        )}
        <div
          className={
            isAtCourseIndex
              ? "hidden min-w-0 flex-1 flex-col sm:flex"
              : "flex min-w-0 flex-1 flex-col"
          }
        >
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}

export default CourseLayout;
