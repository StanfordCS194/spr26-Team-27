import type { Lecture } from "@/types/lectures";

// Real sessions.id values from Postgres. Hand-mapped for now; once auth +
// session management land, lectures will be fetched dynamically.
export const lectures: Lecture[] = [
  {
    id: "1",
    title: "1 - Counting",
    courseId: "cs-109",
    sessionId: "742bcd6f-0896-4a89-8e8c-91abbb11fd95",
  },
  {
    id: "2",
    title: "2 - Combinatorics",
    courseId: "cs-109",
    sessionId: "59d5f5c1-671c-4b6f-917b-f3d1f5d24282",
  },
  {
    id: "3",
    title: "3 - What is Probability?",
    courseId: "cs-109",
    sessionId: "00b10e74-4620-47d8-a298-5cddc8f4e087",
  },
];

export function lectureById(id: string): Lecture | undefined {
  return lectures.find((l) => l.id === id);
}
