import SidebarContext from "@/contexts/SidebarContext";
import { lectures } from "@/data/lectures";
import type { Lecture } from "@/types/lectures";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { use, useEffect, useRef, useState } from "react";
import { IoIosArrowBack, IoIosMenu } from "react-icons/io";
import { MdCheckCircle, MdHelpOutline, MdLogout } from "react-icons/md";

const CONFIRMATION_MS = 4000;

function Topbar(): React.ReactNode {
  const { courseId, lectureId } = useParams({
    from: "/learn/$courseId/lectures/$lectureId",
  });
  const { sidebarOpen, setSidebarOpen } = use(SidebarContext)!;
  const navigate = useNavigate();
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const onSignOut = (): void => {
    void navigate({ to: "/" });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const onLost = (): void => {
    // TODO(backend): POST to a "lost-signal" endpoint so the professor view
    // can aggregate confused students. For now the button is local-only —
    // showing the confirmation lets students still feel acknowledged.
    setShowConfirmation(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setShowConfirmation(false);
      timerRef.current = null;
    }, CONFIRMATION_MS);
  };

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

      <div className="flex items-center gap-6">
        <div className="relative">
          <button
            type="button"
            onClick={onLost}
            aria-label="I'm lost — let the professor know"
            className="bg-primary-accent flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-base font-medium text-white shadow-sm transition"
          >
            <MdHelpOutline className="h-5 w-5" />
            <span className="hidden sm:inline">I'm lost</span>
          </button>
          {showConfirmation && (
            <div
              role="status"
              aria-live="polite"
              className="bg-primary-contr border-divider text-primary absolute top-full right-0 z-50 mt-2 flex w-72 items-start gap-2 rounded-lg border p-3 text-sm shadow-lg"
            >
              <MdCheckCircle className="text-primary-accent mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Got it — the professor has been notified that some students are
                confused.
              </span>
            </div>
          )}
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

        <div className="border-divider flex items-center gap-2 border-l pl-6">
          <div className="bg-primary-tint text-primary-accent-dark flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
            z
          </div>
          <span className="text-primary hidden text-sm font-medium sm:inline">
            zararuth
          </span>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="hover:text-primary-accent hover:bg-primary-tint/60 ml-1 flex h-8 w-8 items-center justify-center rounded-full text-olive-500 transition"
          >
            <MdLogout className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
