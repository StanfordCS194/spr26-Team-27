import SidebarContext from "@/contexts/SidebarContext";
import { lectures } from "@/data/lectures";
import type { Lecture } from "@/types/lectures";
import { Link, useParams } from "@tanstack/react-router";
import { use } from "react";
import { IoIosArrowBack, IoIosMenu } from "react-icons/io";

function Topbar() {
  const { courseId, lectureId } = useParams({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const { sidebarOpen, setSidebarOpen } = use(SidebarContext)!;

  return (
    <div className="border-divider flex shrink-0 items-center justify-between border-b p-6">
      <div className="flex min-w-0 items-center gap-6">
        <Link
          to="/learn/$courseId"
          params={{ courseId }}
          className="shrink-0 sm:hidden"
          aria-label="Back to lectures"
        >
          <IoIosArrowBack className="h-8 w-8" />
        </Link>
        <button
          className="hidden shrink-0 sm:block"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle sidebar"
        >
          <IoIosMenu className="h-8 w-8" />
        </button>
        <p className="truncate text-xl font-medium">
          {sidebarOpen
            ? ""
            : lectures.find((lecture: Lecture) => lecture.id === lectureId)
                ?.title}
        </p>
      </div>

      <div className="flex gap-6 lg:hidden">
        <Link
          to="/learn/$courseId/lectures/$lectureId/ask"
          params={{ courseId, lectureId }}
          className="py-2 text-lg"
          activeProps={{
            className: "border-b-3 py-2 border-primary-accent",
          }}
        >
          Ask
        </Link>
        <Link
          to="/learn/$courseId/lectures/$lectureId/transcript"
          params={{ courseId, lectureId }}
          className="py-2 text-lg"
          activeProps={{
            className: "border-b-3 py-2 border-primary-accent",
          }}
        >
          Transcript
        </Link>
      </div>
    </div>
  );
}

export default Topbar;
