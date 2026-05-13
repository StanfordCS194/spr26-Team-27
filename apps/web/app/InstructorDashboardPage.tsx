import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

interface Course {
  id: string;
  name: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  is_active: number;
}

export default function InstructorDashboardPage() {
  const { instructor } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => {
    fetch("/api/instructor/courses", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { courses: Course[] }) => {
        setCourses(data.courses);
        if (data.courses.length > 0) setSelectedCourse(data.courses[0]);
      });
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    fetch(`/api/instructor/courses/${selectedCourse.id}/sessions`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: { sessions: Session[] }) => setSessions(data.sessions));
  }, [selectedCourse]);

  const startSession = useCallback(async () => {
    if (!selectedCourse) return;
    setStartingSession(true);
    try {
      const res = await fetch(
        `/api/instructor/courses/${selectedCourse.id}/sessions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          void navigate({
            to: "/instructor/session/$sessionId",
            params: { sessionId: data.sessionId },
          });
          return;
        }
        alert(data.error ?? "Failed to start session");
        return;
      }
      const data = await res.json();
      void navigate({
        to: "/instructor/session/$sessionId",
        params: { sessionId: data.sessionId },
      });
    } finally {
      setStartingSession(false);
    }
  }, [selectedCourse, navigate]);

  const activeSession = sessions.find((s) => s.is_active);

  return (
    <div className="flex flex-1 flex-col p-6 md:p-12">
      <h1 className="text-primary mb-2 text-3xl font-bold">
        Welcome, {instructor?.displayName}
      </h1>
      <p className="text-secondary mb-8 text-lg">
        Your link:{" "}
        <span className="text-primary-accent font-semibold">
          inlecture.app/{instructor?.slug}
        </span>
      </p>

      {selectedCourse && (
        <div className="mb-8">
          <h2 className="text-primary mb-4 text-xl font-semibold">
            {selectedCourse.name}
          </h2>

          {activeSession ? (
            <button
              onClick={() =>
                void navigate({
                  to: "/instructor/session/$sessionId",
                  params: { sessionId: activeSession.id },
                })
              }
              className="rounded-xl bg-red-500 px-6 py-3 text-lg font-semibold text-white"
            >
              Rejoin Active Session
            </button>
          ) : (
            <button
              onClick={() => void startSession()}
              disabled={startingSession}
              className="bg-primary-accent text-primary-contr rounded-xl px-6 py-3 text-lg font-semibold disabled:opacity-50"
            >
              {startingSession ? "Starting..." : "Start Live Session"}
            </button>
          )}
        </div>
      )}

      <h2 className="text-primary mb-4 text-xl font-semibold">
        Past Sessions
      </h2>
      {sessions.filter((s) => !s.is_active).length === 0 ? (
        <p className="text-secondary">No past sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions
            .filter((s) => !s.is_active)
            .map((session) => (
              <div
                key={session.id}
                className="border-divider flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="text-primary font-medium">{session.title}</p>
                  <p className="text-secondary text-sm">
                    {new Date(session.started_at).toLocaleString()}
                    {session.ended_at &&
                      ` — ${new Date(session.ended_at).toLocaleString()}`}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
