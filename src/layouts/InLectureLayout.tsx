import Topbar from "@/components/inLecture/Topbar";
import AskPage from "@/pages/AskPage";
import TranscriptPage from "@/pages/TranscriptPage";
import { Outlet } from "@tanstack/react-router";

function InLectureLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Topbar />

      {/* Compact View -> renders ask page OR transcript page */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        <Outlet />
      </div>

      {/* Desktop View -> renders ask page AND transcript page */}
      <div className="divide-divider hidden min-h-0 flex-1 divide-x-2 lg:flex">
        <div className="flex flex-3">
          <AskPage />
        </div>
        <div className="flex flex-1">
          <TranscriptPage />
        </div>
      </div>
    </div>
  );
}

export default InLectureLayout;
