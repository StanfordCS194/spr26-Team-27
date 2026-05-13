CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "transcript_items" ADD COLUMN "audio_storage_path" text;--> statement-breakpoint
ALTER TABLE "transcript_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "course_material_chunks" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "transcript_items_embedding_idx" ON "transcript_items"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "course_material_chunks_embedding_idx" ON "course_material_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
