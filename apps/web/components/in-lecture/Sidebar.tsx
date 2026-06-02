"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = "student" | "instructor";

export interface SidebarSession {
  id: string;
  title: string;
  status: "scheduled" | "live" | "ended";
}

function basePath(mode: Mode, courseSlug: string, sessionId: string): string {
  const root = mode === "student" ? "learn" : "teach";
  const tail = mode === "student" ? "/ask" : "";
  return `/${root}/${courseSlug}/lectures/${sessionId}${tail}`;
}

function SessionLink({
  session,
  mode,
  courseSlug,
}: {
  session: SidebarSession;
  mode: Mode;
  courseSlug: string;
}) {
  const pathname = usePathname();
  const sessionRoot = `/${mode === "student" ? "learn" : "teach"}/${courseSlug}/lectures/${session.id}`;
  const isActive = pathname?.startsWith(sessionRoot);
  const isLive = session.status === "live";

  return (
    <Link
      href={basePath(mode, courseSlug, session.id)}
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
          isLive
            ? "bg-primary-accent animate-pulse"
            : isActive
              ? "bg-primary-accent"
              : "bg-stone-300",
        )}
      />
      <span className="truncate">{session.title}</span>
    </Link>
  );
}

function MaterialsLink({ courseSlug }: { courseSlug: string }) {
  const pathname = usePathname();
  const href = `/teach/${courseSlug}/materials`;
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "mx-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
        isActive
          ? "bg-primary-tint text-primary-accent-dark font-semibold"
          : "text-secondary hover:text-primary hover:bg-stone-100",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      <span className="truncate">Materials</span>
    </Link>
  );
}

interface Props {
  mode: Mode;
  courseSlug: string;
  sessions: readonly SidebarSession[];
}

export default function Sidebar({ mode, courseSlug, sessions }: Props) {
  return (
    <div className="bg-primary-contr flex flex-1 flex-col gap-4 py-4">
      <Link
        href={mode === "student" ? "/learn" : "/teach"}
        aria-label="Back to dashboard"
        className="flex items-center px-5 pt-2"
      >
        <img src="/InLectureLogoWithIcon.svg" alt="InLecture" className="h-7" />
      </Link>
      {mode === "instructor" && (
        <div className="flex flex-col gap-0.5">
          <div className="text-secondary px-5 pb-1 text-[11px] font-semibold tracking-widest uppercase">
            Course
          </div>
          <MaterialsLink courseSlug={courseSlug} />
        </div>
      )}
      <div className="text-secondary px-5 pt-2 text-[11px] font-semibold tracking-widest uppercase">
        {mode === "instructor" ? "Your lectures" : "Lectures"}
      </div>
      {sessions.length === 0 ? (
        <p className="text-secondary px-5 text-xs italic">
          No sessions scheduled yet.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {sessions.map((session) => (
            <SessionLink
              key={session.id}
              session={session}
              mode={mode}
              courseSlug={courseSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
