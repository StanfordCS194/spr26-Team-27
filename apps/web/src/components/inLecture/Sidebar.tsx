import logo from "@/assets/InLectureLogoWithIcon.svg";
import { lectures } from "@/data/lectures";
import type { Lecture } from "@/types/lectures";
import { Link, useMatchRoute } from "@tanstack/react-router";

function LectureLink({ lecture }: { lecture: Lecture }) {
  const matchRoute = useMatchRoute();
  const isActive = matchRoute({
    to: "/learn/$courseId/lectures/$lectureId",
    params: { courseId: lecture.courseId, lectureId: lecture.id },
    fuzzy: true,
  });

  return (
    <Link
      to="/learn/$courseId/lectures/$lectureId/ask"
      params={{ courseId: lecture.courseId, lectureId: lecture.id }}
      className={
        isActive
          ? "bg-primary-tint text-primary-accent px-6 py-3 text-xl"
          : "hover:text-primary px-6 py-3 text-xl hover:bg-gray-100"
      }
    >
      {lecture.title}
    </Link>
  );
}

function Sidebar() {
  return (
    <div className="bg-primary-contr flex flex-1 flex-col">
      <div className="flex items-center justify-center px-3 py-12">
        <img src={logo} alt="InLecture Logo" className="h-10" />
      </div>
      <div className="text-secondary p-6 text-lg font-semibold tracking-wider uppercase">
        Lectures
      </div>
      {lectures.map((lecture: Lecture) => (
        <LectureLink key={lecture.id} lecture={lecture} />
      ))}
    </div>
  );
}

export default Sidebar;
