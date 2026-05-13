import logo from "@/assets/InLectureLogoWithIcon.svg";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface TeachData {
  instructor: { displayName: string; slug: string };
  course: { id: string; name: string } | null;
  activeSession: { id: string; title: string; started_at: string } | null;
  pastSessions: Array<{
    id: string;
    title: string;
    started_at: string;
    ended_at: string;
  }>;
}

export default function TeachPage() {
  const { slug } = useParams({ from: "/teach/$slug" });
  const [data, setData] = useState<TeachData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/teach/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: TeachData) => setData(d))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="bg-primary-bg flex min-h-full flex-col items-center justify-center gap-4 p-6">
        <img src={logo} alt="InLecture" className="h-10" />
        <h1 className="text-primary text-2xl font-bold">Not Found</h1>
        <p className="text-secondary text-lg">
          No instructor found at this link.
        </p>
        <Link to="/" className="text-primary-accent font-semibold">
          Go home
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-primary-bg flex min-h-full items-center justify-center">
        <p className="text-secondary text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-bg flex min-h-full flex-col items-center p-6 md:p-12">
      <img src={logo} alt="InLecture" className="mb-8 h-10" />

      <h1 className="text-primary mb-2 text-3xl font-bold">
        {data.instructor.displayName}
      </h1>
      {data.course && (
        <p className="text-secondary mb-8 text-xl">{data.course.name}</p>
      )}

      {data.activeSession ? (
        <div className="bg-primary-contr mb-8 w-full max-w-lg rounded-2xl p-8 text-center shadow-lg">
          <div className="bg-primary-accent mb-4 inline-block rounded-full px-3 py-1 text-sm font-semibold text-white">
            LIVE NOW
          </div>
          <h2 className="text-primary mb-2 text-2xl font-bold">
            {data.activeSession.title}
          </h2>
          <p className="text-secondary mb-6 text-sm">
            Started {new Date(data.activeSession.started_at).toLocaleString()}
          </p>
          <Link
            to="/learn/$courseId"
            params={{ courseId: data.course?.id ?? "default" }}
            className="bg-primary-accent text-primary-contr inline-block rounded-xl px-8 py-3 text-lg font-semibold"
          >
            Join Session
          </Link>
        </div>
      ) : (
        <div className="bg-primary-contr mb-8 w-full max-w-lg rounded-2xl p-8 text-center shadow-lg">
          <p className="text-secondary text-lg">
            No session is live right now. Check back during class time.
          </p>
        </div>
      )}

      {data.pastSessions.length > 0 && (
        <div className="w-full max-w-lg">
          <h2 className="text-primary mb-4 text-xl font-semibold">
            Past Sessions
          </h2>
          <div className="flex flex-col gap-3">
            {data.pastSessions.map((session) => (
              <div
                key={session.id}
                className="border-divider rounded-xl border bg-white p-4"
              >
                <p className="text-primary font-medium">{session.title}</p>
                <p className="text-secondary text-sm">
                  {new Date(session.started_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
