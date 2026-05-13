-- Add tables that both student and instructor clients subscribe to via
-- Supabase Realtime (broadcasts postgres_changes over WebSocket).
ALTER PUBLICATION supabase_realtime ADD TABLE
  "public"."transcript_items",
  "public"."questions",
  "public"."answers",
  "public"."quick_prompt_signals",
  "public"."concept_checks",
  "public"."concept_check_responses";
