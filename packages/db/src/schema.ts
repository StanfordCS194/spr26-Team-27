import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Minimal pgvector column type. Stored as `vector(<dim>)`; round-tripped as a
// JS number[]. Pinned to 1536 to match OpenAI text-embedding-3-small.
const EMBEDDING_DIM = 1536;
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIM})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return JSON.parse(value) as number[];
  },
});

// Enums --------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["student", "instructor"]);

export const sessionStatus = pgEnum("session_status", [
  "scheduled",
  "live",
  "ended",
]);

export const questionMode = pgEnum("question_mode", ["immediate", "deferred"]);

export const answerStatus = pgEnum("answer_status", [
  "streaming",
  "complete",
  "failed",
]);

export const quickPromptType = pgEnum("quick_prompt_type", [
  "im_lost",
  "re_explain",
  "what_just_happened",
  "give_example",
]);

export const courseMaterialKind = pgEnum("course_material_kind", [
  "slide_deck",
  "note",
  "reading",
]);

export const conceptCheckKind = pgEnum("concept_check_kind", [
  "multiple_choice",
  "short_answer",
]);

// Auth & directory ---------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    role: userRole("role").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("users_email_unique").on(t.email)],
).enableRLS();

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  // PRD Feature 1: persistent human-readable URL (e.g. "smith184").
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  instructorId: uuid("instructor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("enrollments_user_course_unique").on(t.userId, t.courseId)],
).enableRLS();

// Live lecture instance ----------------------------------------------------

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: sessionStatus("status").notNull().default("scheduled"),
  // Manual fallback for students joining without the persistent link (PRD F1).
  joinCode: text("join_code").unique(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

// Either an authenticated user OR a browser-local anonymous identity attended
// this session. Anonymous students don't get a `users` row (PRD F4 stores
// their history locally until conversion); the participant row is what server
// features like confusion signals or instructor questions hang off.
export const sessionParticipants = pgTable(
  "session_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    anonymousClientId: text("anonymous_client_id"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "session_participants_exactly_one_identity",
      sql`(${t.userId} IS NOT NULL) <> (${t.anonymousClientId} IS NOT NULL)`,
    ),
    unique("session_participants_session_user_unique").on(
      t.sessionId,
      t.userId,
    ),
    unique("session_participants_session_anon_unique").on(
      t.sessionId,
      t.anonymousClientId,
    ),
  ],
).enableRLS();

// Transcript & grounding ---------------------------------------------------

export const transcriptItems = pgTable(
  "transcript_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    timestampSeconds: integer("timestamp_seconds").notNull(),
    content: text("content").notNull(),
    // Optional reference to the audio chunk this line was transcribed from
    // (Supabase Storage path). NULL when transcript was imported, not recorded.
    audioStoragePath: text("audio_storage_path"),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("transcript_items_session_sequence_unique").on(
      t.sessionId,
      t.sequence,
    ),
    index("transcript_items_embedding_idx")
      .using("hnsw", sql`${t.embedding} vector_cosine_ops`)
      .where(sql`${t.embedding} IS NOT NULL`),
  ],
).enableRLS();

export const courseMaterials = pgTable("course_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  kind: courseMaterialKind("kind").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

export const courseMaterialChunks = pgTable(
  "course_material_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseMaterialId: uuid("course_material_id")
      .notNull()
      .references(() => courseMaterials.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    embedding: vector("embedding"),
  },
  (t) => [
    unique("course_material_chunks_material_index_unique").on(
      t.courseMaterialId,
      t.chunkIndex,
    ),
    index("course_material_chunks_embedding_idx")
      .using("hnsw", sql`${t.embedding} vector_cosine_ops`)
      .where(sql`${t.embedding} IS NOT NULL`),
  ],
).enableRLS();

// Q&A ----------------------------------------------------------------------

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => sessionParticipants.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mode: questionMode("mode").notNull(),
  // Captures what was on screen / latest revealed transcript line at the moment
  // the question was asked — useful for both grounding and analytics.
  anchorTranscriptItemId: uuid("anchor_transcript_item_id").references(
    () => transcriptItems.id,
    { onDelete: "set null" },
  ),
  askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    status: answerStatus("status").notNull().default("streaming"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique("answers_question_unique").on(t.questionId)],
).enableRLS();

// PRD Feature 11: every AI response cites the transcript segment OR uploaded
// material it grounds in. Modelled with two nullable FKs + a CHECK that
// exactly one is populated, so downstream code can switch on which side is set
// without losing real referential integrity.
export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    transcriptItemId: uuid("transcript_item_id").references(
      () => transcriptItems.id,
      { onDelete: "cascade" },
    ),
    courseMaterialChunkId: uuid("course_material_chunk_id").references(
      () => courseMaterialChunks.id,
      { onDelete: "cascade" },
    ),
    snippet: text("snippet").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "citations_exactly_one_source",
      sql`(${t.transcriptItemId} IS NOT NULL) <> (${t.courseMaterialChunkId} IS NOT NULL)`,
    ),
  ],
).enableRLS();

// Engagement signals -------------------------------------------------------

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => sessionParticipants.id, { onDelete: "cascade" }),
    transcriptItemId: uuid("transcript_item_id")
      .notNull()
      .references(() => transcriptItems.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("bookmarks_participant_transcript_unique").on(
      t.participantId,
      t.transcriptItemId,
    ),
  ],
).enableRLS();

export const quickPromptSignals = pgTable("quick_prompt_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => sessionParticipants.id, { onDelete: "cascade" }),
  promptType: quickPromptType("prompt_type").notNull(),
  // Nearest revealed transcript line at the time of the tap; this is what the
  // confusion-threshold indicator (PRD F19) clusters around.
  anchorTranscriptItemId: uuid("anchor_transcript_item_id").references(
    () => transcriptItems.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

// Instructor-driven engagement --------------------------------------------

export const conceptChecks = pgTable("concept_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  kind: conceptCheckKind("kind").notNull(),
  // For multiple_choice, an array of option strings; null for short_answer.
  choices: jsonb("choices").$type<string[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}).enableRLS();

export const conceptCheckResponses = pgTable(
  "concept_check_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conceptCheckId: uuid("concept_check_id")
      .notNull()
      .references(() => conceptChecks.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => sessionParticipants.id, { onDelete: "cascade" }),
    response: text("response").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("concept_check_responses_check_participant_unique").on(
      t.conceptCheckId,
      t.participantId,
    ),
  ],
).enableRLS();

// Type exports for use in app code ----------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type NewSessionParticipant = typeof sessionParticipants.$inferInsert;
export type TranscriptItem = typeof transcriptItems.$inferSelect;
export type NewTranscriptItem = typeof transcriptItems.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
export type Citation = typeof citations.$inferSelect;
export type NewCitation = typeof citations.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type QuickPromptSignal = typeof quickPromptSignals.$inferSelect;
export type NewQuickPromptSignal = typeof quickPromptSignals.$inferInsert;
export type ConceptCheck = typeof conceptChecks.$inferSelect;
export type NewConceptCheck = typeof conceptChecks.$inferInsert;
export type ConceptCheckResponse = typeof conceptCheckResponses.$inferSelect;
export type NewConceptCheckResponse = typeof conceptCheckResponses.$inferInsert;
export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type NewCourseMaterial = typeof courseMaterials.$inferInsert;
export type CourseMaterialChunk = typeof courseMaterialChunks.$inferSelect;
export type NewCourseMaterialChunk = typeof courseMaterialChunks.$inferInsert;
