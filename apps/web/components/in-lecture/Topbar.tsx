"use client";

import { useSidebar } from "@/components/in-lecture/SidebarContext";
import { Badge } from "@/components/ui/Badge";
import { lectures } from "@/data/lectures";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IoIosArrowBack, IoIosMenu } from "react-icons/io";
import { MdCheckCircle, MdHelpOutline, MdLogout } from "react-icons/md";

type Mode = "student" | "instructor";
const CONFIRMATION_MS = 4000;

export default function Topbar({ mode }: { mode: Mode }) {
  const params = useParams<{ courseId: string; lectureId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  const courseId = params.courseId;
  const lectureId = params.lectureId;
  const root = mode === "student" ? "learn" : "teach";
  const lecture = lectures.find((l) => l.id === lectureId);

  const askActive = pathname?.endsWith("/ask");
  const transcriptActive = pathname?.endsWith("/transcript");

  const [confused, setConfused] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const onLost = () => {
    setConfused(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setConfused(false);
      timerRef.current = null;
    }, CONFIRMATION_MS);
  };

  return (
    <div className="border-divider bg-primary-contr flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/${root}/${courseId}`}
          className="text-secondary hover:text-primary shrink-0 sm:hidden"
          aria-label="Back to lectures"
        >
          <IoIosArrowBack className="h-6 w-6" />
        </Link>
        <button
          className="text-secondary hover:text-primary hidden shrink-0 rounded-md p-1 transition hover:bg-stone-100 sm:block"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle sidebar"
        >
          <IoIosMenu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <p className="text-primary truncate text-sm font-semibold">
            {lecture?.title ?? "Lecture"}
          </p>
          <span className="text-secondary hidden text-xs sm:inline">
            · {courseId?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {mode === "student" && (
          <>
            <div className="relative">
              <button
                type="button"
                onClick={onLost}
                aria-label="I'm lost — let the professor know"
                className="bg-primary-accent hover:bg-primary-accent-dark flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
              >
                <MdHelpOutline className="h-4 w-4" />
                <span className="hidden sm:inline">I&apos;m lost</span>
              </button>
              {confused && (
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-primary-contr border-divider text-primary absolute top-full right-0 z-50 mt-2 flex w-72 items-start gap-2 rounded-lg border p-3 text-xs shadow-lg"
                >
                  <MdCheckCircle className="text-primary-accent mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Got it — the professor has been notified that some students
                    are confused.
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 lg:hidden">
              <Link
                href={`/learn/${courseId}/lectures/${lectureId}/ask`}
                className={
                  askActive
                    ? "border-primary-accent text-primary border-b-2 py-1 text-xs font-semibold"
                    : "text-secondary py-1 text-xs"
                }
              >
                Ask
              </Link>
              <Link
                href={`/learn/${courseId}/lectures/${lectureId}/transcript`}
                className={
                  transcriptActive
                    ? "border-primary-accent text-primary border-b-2 py-1 text-xs font-semibold"
                    : "text-secondary py-1 text-xs"
                }
              >
                Transcript
              </Link>
            </div>
          </>
        )}

        {mode === "instructor" && <Badge tone="neutral">scheduled</Badge>}

        <div className="border-divider hidden items-center gap-2 border-l pl-3 sm:flex">
          <div className="bg-primary-tint text-primary-accent-dark flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {mode === "instructor" ? "I" : "S"}
          </div>
          <span className="text-primary text-xs font-medium">
            {mode === "instructor" ? "Instructor" : "Student"}
          </span>
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Sign out"
            className="text-secondary hover:text-primary-accent ml-1 flex h-7 w-7 items-center justify-center rounded-full transition"
          >
            <MdLogout className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
