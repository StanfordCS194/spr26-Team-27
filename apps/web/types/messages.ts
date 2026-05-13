import type { CitationManifest, ToolEvent } from "@/lib/qa";

export interface Message {
  id: string;
  content: string;
  role: "student" | "inLecture";
  lectureId: string;
  citations?: CitationManifest;
  toolCalls?: ToolEvent[];
}
