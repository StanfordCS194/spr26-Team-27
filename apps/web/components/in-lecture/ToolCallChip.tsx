import type { ToolEvent } from "@/lib/qa";
import { MdSearch, MdHistoryToggleOff, MdAutoAwesome } from "react-icons/md";

const ICONS: Record<string, React.ReactNode> = {
  search_lecture: <MdSearch className="h-3.5 w-3.5" />,
  get_recent: <MdHistoryToggleOff className="h-3.5 w-3.5" />,
};

function labelFor(tool: ToolEvent): string {
  if (tool.name === "search_lecture") {
    const q = (tool.args?.query as string | undefined) ?? "";
    return q ? `Searched: "${q}"` : "Searched lecture";
  }
  if (tool.name === "get_recent") {
    const s = tool.args?.seconds as number | undefined;
    return s ? `Pulled last ${s}s of transcript` : "Pulled recent transcript";
  }
  return tool.name;
}

export function ToolCallChip({ tool }: { tool: ToolEvent }) {
  const pending = tool.resultCount === undefined;
  return (
    <div className="bg-primary-tint/60 text-primary-accent-dark border-divider inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium">
      <span className="text-primary-accent inline-flex items-center">
        {ICONS[tool.name] ?? <MdAutoAwesome className="h-3.5 w-3.5" />}
      </span>
      <span>{labelFor(tool)}</span>
      {pending ? (
        <span className="text-primary-accent inline-flex gap-0.5">
          <span className="bg-primary-accent inline-block h-1 w-1 animate-pulse rounded-full" />
          <span
            className="bg-primary-accent inline-block h-1 w-1 animate-pulse rounded-full"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="bg-primary-accent inline-block h-1 w-1 animate-pulse rounded-full"
            style={{ animationDelay: "240ms" }}
          />
        </span>
      ) : (
        <span className="text-secondary text-[10px]">
          {tool.resultCount} {tool.resultCount === 1 ? "hit" : "hits"}
        </span>
      )}
    </div>
  );
}
