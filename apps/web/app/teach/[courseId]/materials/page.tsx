import { MaterialsPanel } from "@/components/instructor/MaterialsPanel";

// Course-level page: instructors upload readings / slides / notes that get
// parsed (LlamaParse), contextualized, embedded, and made searchable by the
// QA assistant's search_course_materials tool. `courseId` is the course slug.
export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <MaterialsPanel courseSlug={courseId} />
    </div>
  );
}
