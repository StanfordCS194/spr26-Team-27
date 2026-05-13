import AskPanel from "@/components/in-lecture/AskPanel";
import TranscriptPanel from "@/components/in-lecture/TranscriptPanel";

export default function AskRoute() {
  return (
    <>
      {/* Compact view: just Ask */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        <AskPanel />
      </div>
      {/* Desktop: dual-pane */}
      <div className="divide-divider hidden min-h-0 flex-1 divide-x-2 lg:flex">
        <div className="flex flex-3">
          <AskPanel />
        </div>
        <div className="flex flex-1">
          <TranscriptPanel />
        </div>
      </div>
    </>
  );
}
