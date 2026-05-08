import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createDb } from "./index.ts";
import {
  courses,
  enrollments,
  sessionParticipants,
  sessions,
  transcriptItems,
  users,
} from "./schema.ts";

interface RawTranscriptItem {
  timestamp: string;
  content: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPT_PATH = resolve(
  HERE,
  "..",
  "..",
  "..",
  "apps",
  "web",
  "src",
  "data",
  "transcript.json",
);

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (see packages/db/.env.example)");
  }

  const db = createDb(databaseUrl);

  const raw = await readFile(TRANSCRIPT_PATH, "utf8");
  const parsed = JSON.parse(raw) as RawTranscriptItem[];
  const visible = parsed.filter((l) => l.content.trim() !== "");

  await db.transaction(async (tx) => {
    // Wipe in dependency order. Truncate-cascade would be shorter but explicit
    // deletes make it obvious which tables the seed owns.
    await tx.delete(transcriptItems);
    await tx.delete(sessionParticipants);
    await tx.delete(sessions);
    await tx.delete(enrollments);
    await tx.delete(courses);
    await tx.delete(users);

    const [instructor] = await tx
      .insert(users)
      .values({
        email: "cpiech@stanford.edu",
        role: "instructor",
        displayName: "Chris Piech",
      })
      .returning();
    if (!instructor) throw new Error("failed to seed instructor");

    const [student] = await tx
      .insert(users)
      .values({
        email: "student@stanford.edu",
        role: "student",
        displayName: "Demo Student",
      })
      .returning();
    if (!student) throw new Error("failed to seed student");

    const [course] = await tx
      .insert(courses)
      .values({
        slug: "piech109",
        title: "CS 109: Introduction to Probability",
        instructorId: instructor.id,
      })
      .returning();
    if (!course) throw new Error("failed to seed course");

    await tx.insert(enrollments).values({
      userId: student.id,
      courseId: course.id,
    });

    // Mirrors the three lectures rendered in the sidebar today; only the first
    // gets transcript rows so the existing /api/qa flow has data to work with.
    const lectureTitles = [
      "1 - Counting",
      "2 - Combinatorics",
      "3 - What is Probability?",
    ];
    const lectureRows = await tx
      .insert(sessions)
      .values(
        lectureTitles.map((title, idx) => ({
          courseId: course.id,
          title,
          status: idx === 0 ? ("ended" as const) : ("scheduled" as const),
        })),
      )
      .returning();

    const firstLecture = lectureRows[0];
    if (!firstLecture) throw new Error("failed to seed lectures");

    await tx.insert(sessionParticipants).values({
      sessionId: firstLecture.id,
      userId: student.id,
    });

    if (visible.length > 0) {
      await tx.insert(transcriptItems).values(
        visible.map((line, idx) => ({
          sessionId: firstLecture.id,
          sequence: idx,
          timestampSeconds: timestampToSeconds(line.timestamp),
          content: line.content,
        })),
      );
    }

    console.log(
      `seeded: 1 instructor, 1 student, 1 course, ${lectureRows.length} sessions, ${visible.length} transcript items`,
    );
  });

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
