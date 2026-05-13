import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { eq } from "drizzle-orm";
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

  // Seeds the *structural* data — instructor user, course, sessions,
  // transcript_items — but NOT a student user. Students arrive through the
  // sign-up flow on the web app, which routes them through the
  // handle_new_auth_user trigger so public.users.id === auth.users.id (and
  // therefore RLS policies that check auth.uid() match correctly).
  //
  // Seeding a student here with a random UUID would create an id mismatch
  // that breaks realtime delivery for that account, even though Drizzle
  // queries on the server would still find the row by email.
  const seededStudentEmail = process.env.SEED_STUDENT_EMAIL;
  let courseSlug = "";
  let sessionIds: string[] = [];

  // Hardcoded session UUIDs so apps/web/data/lectures.ts (which maps friendly
  // ids "1"/"2"/"3" → these uuids) keeps working without a runtime lookup.
  // If you change these, also update lectures.ts.
  const LECTURE_ROWS: readonly {
    id: string;
    title: string;
    status: "ended" | "scheduled";
  }[] = [
    {
      id: "742bcd6f-0896-4a89-8e8c-91abbb11fd95",
      title: "1 - Counting",
      status: "ended",
    },
    {
      id: "59d5f5c1-671c-4b6f-917b-f3d1f5d24282",
      title: "2 - Combinatorics",
      status: "scheduled",
    },
    {
      id: "00b10e74-4620-47d8-a298-5cddc8f4e087",
      title: "3 - What is Probability?",
      status: "scheduled",
    },
  ];

  await db.transaction(async (tx) => {
    // Wipe in dependency order. Truncate-cascade would be shorter but
    // explicit deletes make it obvious which tables the seed owns.
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

    const [course] = await tx
      .insert(courses)
      .values({
        // Slug matches the courseId hardcoded in apps/web/data/lectures.ts
        // so that lectures.ts's (lectureId → sessionId) mapping resolves
        // through to a real course in the DB.
        slug: "cs-109",
        title: "CS 109: Introduction to Probability",
        instructorId: instructor.id,
      })
      .returning();
    if (!course) throw new Error("failed to seed course");
    courseSlug = course.slug;

    const lectureRows = await tx
      .insert(sessions)
      .values(
        LECTURE_ROWS.map((l) => ({
          id: l.id,
          courseId: course.id,
          title: l.title,
          status: l.status,
        })),
      )
      .returning();

    const firstLecture = lectureRows[0];
    if (!firstLecture) throw new Error("failed to seed lectures");
    sessionIds = lectureRows.map((l) => l.id);

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

    // Optional: pre-enroll an existing student account by email. Useful
    // when re-seeding mid-demo and you don't want to re-sign-up. The
    // matching public.users row must already exist (created by the
    // trigger on Supabase Auth sign-up).
    if (seededStudentEmail) {
      const [student] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, seededStudentEmail))
        .limit(1);
      if (student) {
        await tx
          .insert(enrollments)
          .values({ userId: student.id, courseId: course.id })
          .onConflictDoNothing();
      } else {
        console.warn(
          `SEED_STUDENT_EMAIL was set but no public.users row exists for ${seededStudentEmail}. Sign up first, then re-run seed.`,
        );
      }
    }
  });

  console.log(
    `seeded: 1 instructor, 1 course (${courseSlug}), ${sessionIds.length} sessions, ${visible.length} transcript items`,
  );
  console.log("\nNext steps:");
  console.log(
    `  1. Sign up at http://localhost:3000/signup with course code "${courseSlug}"`,
  );
  console.log(
    `  2. Land on http://localhost:3000/learn — past lecture "1 - Counting" should be visible`,
  );
  console.log(`\nSession ids (for the instructor side):`);
  for (const id of sessionIds) {
    console.log(
      `  /teach/${courseSlug}/lectures/${id}  → start recording to flip status='live'`,
    );
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
