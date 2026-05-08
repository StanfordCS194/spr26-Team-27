import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/InLectureLogoWithIcon.svg";
import { Outlet, useNavigate, Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/instructor")({
  component: InstructorLayout,
});

function InstructorLayout() {
  const { instructor, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !instructor) {
      void navigate({ to: "/login" });
    }
  }, [loading, instructor, navigate]);

  if (loading) {
    return (
      <div className="bg-primary-bg flex min-h-full items-center justify-center">
        <p className="text-secondary text-xl">Loading...</p>
      </div>
    );
  }

  if (!instructor) return null;

  return (
    <div className="bg-primary-bg flex min-h-full flex-col">
      <div className="border-divider flex items-center justify-between border-b px-6 py-4">
        <Link to="/instructor">
          <img src={logo} alt="InLecture" className="h-8" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-secondary text-sm">
            {instructor.displayName}
          </span>
          <button
            onClick={() => void logout().then(() => navigate({ to: "/" }))}
            className="text-secondary hover:text-primary text-sm"
          >
            Log out
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
