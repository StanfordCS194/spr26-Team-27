-- Drop orphan table from pre-drizzle Supabase prototype (not tracked by schema).
DROP TABLE IF EXISTS "public"."lectures" CASCADE;--> statement-breakpoint
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "citations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "concept_check_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "concept_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_material_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quick_prompt_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcript_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;