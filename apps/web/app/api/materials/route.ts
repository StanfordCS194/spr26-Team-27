import { db } from "@/lib/db";
import { getInstructorOrNull } from "@/lib/auth";
import {
  chunkPages,
  contextualizeChunks,
  embedChunks,
  embedText,
  fullDocumentText,
  parseFile,
} from "@/lib/materials";
import {
  courseMaterialChunks,
  courseMaterials,
  courses,
  sessions,
} from "@spr26/db";
import { and, desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Parsing (LlamaParse poll) + per-chunk contextualization can take a while for
// a large deck; give it room. Trim on Vercel plans with a lower ceiling.
export const maxDuration = 300;

const KINDS = ["slide_deck", "note", "reading"] as const;
type Kind = (typeof KINDS)[number];

// Resolve a course by slug and confirm the signed-in instructor owns it.
// Returns the course id, or a Response to short-circuit (401/403/404).
async function requireOwnedCourse(
  slug: string,
): Promise<{ courseId: string } | { error: Response }> {
  const instructor = await getInstructorOrNull();
  if (!instructor) {
    return {
      error: Response.json({ error: "not signed in" }, { status: 401 }),
    };
  }
  const [course] = await db()
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  if (!course) {
    return {
      error: Response.json({ error: "course not found" }, { status: 404 }),
    };
  }
  if (course.instructorId !== instructor.id) {
    return {
      error: Response.json({ error: "not your course" }, { status: 403 }),
    };
  }
  return { courseId: course.id };
}

// Upload + ingest a course material. Parses with LlamaParse, chunks the
// per-page markdown, contextualizes + embeds each chunk, and writes
// course_materials + course_material_chunks. The material row is created
// `parsing` up front so the UI can show progress, then flipped to `ready` /
// `failed`. An optional sessionId attaches the material to a specific lecture.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "expected multipart form data" },
      { status: 400 },
    );
  }

  const courseSlug = form.get("courseSlug");
  const kindRaw = form.get("kind");
  const file = form.get("file");
  const titleRaw = form.get("title");
  const sessionIdRaw = form.get("sessionId");

  if (typeof courseSlug !== "string" || !courseSlug) {
    return Response.json({ error: "courseSlug is required" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  const kind: Kind = KINDS.includes(kindRaw as Kind)
    ? (kindRaw as Kind)
    : "reading";
  const title =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim()
      : file.name;

  const owned = await requireOwnedCourse(courseSlug);
  if ("error" in owned) return owned.error;
  const { courseId } = owned;

  // Optional lecture association — must belong to this course.
  let sessionId: string | null = null;
  if (typeof sessionIdRaw === "string" && sessionIdRaw) {
    const [session] = await db()
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionIdRaw), eq(sessions.courseId, courseId)),
      )
      .limit(1);
    if (!session) {
      return Response.json(
        { error: "session not in this course" },
        { status: 400 },
      );
    }
    sessionId = session.id;
  }

  const [material] = await db()
    .insert(courseMaterials)
    .values({ courseId, sessionId, kind, title, status: "parsing" })
    .returning({ id: courseMaterials.id });

  try {
    const { pages, pageCount } = await parseFile(file);
    const chunks = chunkPages(pages);
    if (chunks.length === 0)
      throw new Error("no chunks produced from document");

    const contexts = await contextualizeChunks(fullDocumentText(pages), chunks);
    const embeddings = await embedChunks(
      chunks.map((c, i) => embedText(c, contexts[i])),
    );

    await db()
      .insert(courseMaterialChunks)
      .values(
        chunks.map((c, i) => ({
          courseMaterialId: material.id,
          chunkIndex: c.index,
          content: c.content,
          context: contexts[i],
          pageNumber: c.pageNumber,
          embedding: embeddings[i],
        })),
      );

    await db()
      .update(courseMaterials)
      .set({ status: "ready", pageCount, error: null })
      .where(eq(courseMaterials.id, material.id));

    return Response.json({
      materialId: material.id,
      chunks: chunks.length,
      pageCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingestion failed";
    await db()
      .update(courseMaterials)
      .set({ status: "failed", error: message })
      .where(eq(courseMaterials.id, material.id));
    return Response.json(
      { error: message, materialId: material.id },
      { status: 502 },
    );
  }
}

// List a course's materials (with chunk counts) for the instructor UI.
// `?sessionId=` narrows to one lecture's materials; otherwise returns all for
// the course.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("courseSlug");
  const sessionId = url.searchParams.get("sessionId");
  if (!slug) {
    return Response.json({ error: "courseSlug is required" }, { status: 400 });
  }

  const owned = await requireOwnedCourse(slug);
  if ("error" in owned) return owned.error;
  const { courseId } = owned;

  const rows = await db()
    .select({
      id: courseMaterials.id,
      title: courseMaterials.title,
      kind: courseMaterials.kind,
      status: courseMaterials.status,
      error: courseMaterials.error,
      pageCount: courseMaterials.pageCount,
      sessionId: courseMaterials.sessionId,
      uploadedAt: courseMaterials.uploadedAt,
      chunkCount: sql<number>`count(${courseMaterialChunks.id})::int`,
    })
    .from(courseMaterials)
    .leftJoin(
      courseMaterialChunks,
      eq(courseMaterialChunks.courseMaterialId, courseMaterials.id),
    )
    .where(
      sessionId
        ? and(
            eq(courseMaterials.courseId, courseId),
            eq(courseMaterials.sessionId, sessionId),
          )
        : eq(courseMaterials.courseId, courseId),
    )
    .groupBy(courseMaterials.id)
    .orderBy(desc(courseMaterials.uploadedAt));

  return Response.json({ materials: rows });
}
