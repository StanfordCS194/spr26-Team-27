import type { Message } from "@/types/messages";

export const messages: Message[] = [
  {
    id: "1",
    content:
      "In this counting slide, when do we use permutations vs combinations?",
    role: "student",
    lectureId: "1",
  },
  {
    id: "2",
    content:
      "Use permutations when order matters and combinations when order does not. Right now in Lecture 1, they're emphasizing this distinction with counting examples.",
    role: "inLecture",
    lectureId: "1",
  },
  {
    id: "3",
    content:
      "The professor just wrote n choose k. Why do we divide by k factorial?",
    role: "student",
    lectureId: "1",
  },
  {
    id: "4",
    content:
      "Because choosing k items ignores order, and each group of k items can be arranged in k! different ways. Dividing by k! removes those duplicate orderings.",
    role: "inLecture",
    lectureId: "1",
  },
];
