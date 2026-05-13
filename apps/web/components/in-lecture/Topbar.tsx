"use client";

import { useSidebar } from "@/components/in-lecture/SidebarContext";
import { useStudentSession } from "@/components/in-lecture/StudentSessionContext";
import { Badge } from "@/components/ui/Badge";
import { signOut } from "@/lib/actions/auth";
import { recordQuickPrompt } from "@/lib/actions/engagement";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IoIosArrowBack, IoIosMenu } from "react-icons/io";
import { MdCheckCircle, MdHelpOutline, MdLogout } from "react-icons/md";

type Mode = "student" | "instructor";
const CONFIRMATION_MS = 4000;

interface Props {
  mode: Mode;
  courseSlug: string;
  sessionTitle: string;
  sessionStatus: "scheduled" | "live" | "ended";
  // Only required when mode === "student"; the I'm-lost button persists
  // against this session.
  sessionId?: string;
}

export default function Topbar({
  mode,
  courseSlug,
  sessionTitle,
  sessionStatus,
  sessionId,
}: Props) {
  const params = useParams<{ lectureId: string }>();
  const pathname = usePathname();
  const { setSidebarOpen } = useSidebar();

  const lectureId = params.lectureId;
  const root = mode === "student" ? "learn" : "teach";

  const askActive = pathname?.endsWith("/ask");
  const transcriptActive = pathname?.endsWith("/transcript");

  return (
    <div className="border-divider bg-primary-contr flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/${root}/${courseSlug}`}
          className="text-secondary hover:text-primary shrink-0 sm:hidden"
          aria-label="Back to course"
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
            {sessionTitle}
          </p>
          <span className="text-secondary hidden text-xs sm:inline">
            · {courseSlug.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {mode === "student" && sessionStatus === "live" && sessionId && (
          <ImLostButton sessionId={sessionId} />
        )}

        {mode === "student" && (
          <div className="flex gap-3 lg:hidden">
            <Link
              href={`/learn/${courseSlug}/lectures/${lectureId}/ask`}
              className={
                askActive
                  ? "border-primary-accent text-primary border-b-2 py-1 text-xs font-semibold"
                  : "text-secondary py-1 text-xs"
              }
            >
              Ask
            </Link>
            <Link
              href={`/learn/${courseSlug}/lectures/${lectureId}/transcript`}
              className={
                transcriptActive
                  ? "border-primary-accent text-primary border-b-2 py-1 text-xs font-semibold"
                  : "text-secondary py-1 text-xs"
              }
            >
              Transcript
            </Link>
          </div>
        )}

        {mode === "instructor" && (
          <Badge
            tone={sessionStatus === "live" ? "live" : "neutral"}
            pulse={sessionStatus === "live"}
          >
            {sessionStatus}
          </Badge>
        )}

        <div className="border-divider hidden items-center gap-2 border-l pl-3 sm:flex">
          <div className="bg-primary-tint text-primary-accent-dark flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {mode === "instructor" ? "I" : "S"}
          </div>
          <span className="text-primary text-xs font-medium">
            {mode === "instructor" ? "Instructor" : "Student"}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="text-secondary hover:text-primary-accent ml-1 flex h-7 w-7 items-center justify-center rounded-full transition"
            >
              <MdLogout className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// "I'm lost" — fire-and-forget INSERT into quick_prompt_signals with
// promptType='im_lost'. The aggregate count feeds the instructor's
// confusion threshold indicator (PRD F19). The toast confirms the signal
// was sent without making the student commit a typed question.
function ImLostButton({ sessionId }: { sessionId: string }) {
  const { lines } = useStudentSession();
  const [confused, setConfused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const onLost = () => {
    const anchor = lines[lines.length - 1]?.id ?? null;
    // Fire-and-forget. If the insert fails (network blip, RLS error), we
    // still show the optimistic toast — the student's intent is the
    // valuable signal, the row is just analytics.
    void recordQuickPrompt(sessionId, "im_lost", anchor);

    setConfused(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setConfused(false);
      timerRef.current = null;
    }, CONFIRMATION_MS);
  };

  return (
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
            Got it — the professor has been notified that some students are
            confused.
          </span>
        </div>
      )}
    </div>
  );
}
