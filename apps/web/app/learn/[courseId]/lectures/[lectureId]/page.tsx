import { redirect } from "next/navigation";

export default async function StudentLectureIndex({
  params,
}: {
  params: Promise<{ courseId: string; lectureId: string }>;
}) {
  const { courseId, lectureId } = await params;
  redirect(`/learn/${courseId}/lectures/${lectureId}/ask`);
}
