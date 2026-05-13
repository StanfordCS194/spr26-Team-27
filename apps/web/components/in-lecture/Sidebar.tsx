"use client";

import { lectures } from "@/data/lectures";
import { cn } from "@/lib/utils";
import type { Lecture } from "@/types/lectures";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = "student" | "instructor";

function basePath(mode: Mode, lecture: Lecture) {
  const root = mode === "student" ? "learn" : "teach";
  const tail = mode === "student" ? "/ask" : "";
  return `/${root}/${lecture.courseId}/lectures/${lecture.id}${tail}`;
}

function LectureLink({ lecture, mode }: { lecture: Lecture; mode: Mode }) {
  const pathname = usePathname();
  const lectureRoot = `/${mode === "student" ? "learn" : "teach"}/${lecture.courseId}/lectures/${lecture.id}`;
  const isActive = pathname?.startsWith(lectureRoot);

  return (
    <Link
      href={basePath(mode, lecture)}
      className={cn(
        "mx-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
        isActive
          ? "bg-primary-tint text-primary-accent-dark font-semibold"
          : "text-secondary hover:text-primary hover:bg-stone-100",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full transition",
          isActive ? "bg-primary-accent" : "bg-stone-300",
        )}
      />
      <span className="truncate">{lecture.title}</span>
    </Link>
  );
}

export default function Sidebar({ mode }: { mode: Mode }) {
  return (
    <div className="bg-primary-contr flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center px-5 pt-2">
        <img src="/InLectureLogoWithIcon.svg" alt="InLecture" className="h-7" />
      </div>
      <div className="text-secondary px-5 pt-2 text-[11px] font-semibold tracking-widest uppercase">
        {mode === "instructor" ? "Your lectures" : "Lectures"}
      </div>
      <div className="flex flex-col gap-0.5">
        {lectures.map((lecture) => (
          <LectureLink key={lecture.id} lecture={lecture} mode={mode} />
        ))}
      </div>
    </div>
  );
}
