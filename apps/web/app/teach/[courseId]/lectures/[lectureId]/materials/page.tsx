import Link from "next/link";
import { MdArrowBack } from "react-icons/md";

import { MaterialsPanel } from "@/components/instructor/MaterialsPanel";

// Per-lecture materials: uploads here attach to this lecture (session). The
// in-lecture assistant still searches the whole course, so these also help
// students in other lectures. [lectureId] is the session UUID; the lecture
// layout already gated instructor ownership.
export default async function LectureMaterialsPage({
  params,
}: {
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/teach/${courseId}/lectures/${lectureId}`}
          className="text-secondary hover:text-primary mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <MdArrowBack className="h-4 w-4" />
          Back to lecture
        </Link>
        <MaterialsPanel courseSlug={courseId} sessionId={lectureId} />
      </div>
    </div>
  );
}
