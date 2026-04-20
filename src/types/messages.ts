export interface Message {
  id: string;
  content: string;
  role: "student" | "inLecture";
  lectureId: string;
}
