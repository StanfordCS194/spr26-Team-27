import logo from "@/assets/InLectureLogoWithIcon.svg";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        return;
      }
      void navigate({ to: "/instructor" });
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-primary-bg flex min-h-full items-center justify-center p-6">
      <div className="bg-primary-contr w-full max-w-md rounded-2xl p-8 shadow-lg">
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="InLecture" className="h-10" />
        </div>
        <h1 className="text-primary mb-6 text-center text-2xl font-bold">
          Instructor Login
        </h1>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-divider text-primary rounded-xl border p-4 text-lg"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-divider text-primary rounded-xl border p-4 text-lg"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary-accent text-primary-contr rounded-xl p-4 text-lg font-semibold disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>
        <p className="text-secondary mt-6 text-center">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary-accent font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
