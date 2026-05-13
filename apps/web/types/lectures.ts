export interface Lecture {
  id: string;
  title: string;
  courseId: string;
  /** Real sessions.id (UUID) in Postgres. Threaded through to the API for
   *  transcribe / load-sample / reset / RAG. */
  sessionId: string;
}
