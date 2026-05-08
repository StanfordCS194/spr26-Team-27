import logo from "@/assets/InLectureLogoWithIcon.svg";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, displayName, slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Signup failed");
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
          Create Instructor Account
        </h1>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Display Name (e.g. Prof. Smith)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="border-divider text-primary rounded-xl border p-4 text-lg"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-divider text-primary rounded-xl border p-4 text-lg"
          />
          <div>
            <input
              type="text"
              placeholder="Your link slug (e.g. smith184)"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              required
              className="border-divider text-primary w-full rounded-xl border p-4 text-lg"
            />
            <p className="text-secondary mt-1 px-1 text-sm">
              Your link: inlecture.app/<strong>{slug || "..."}</strong>
            </p>
          </div>
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border-divider text-primary rounded-xl border p-4 text-lg"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary-accent text-primary-contr rounded-xl p-4 text-lg font-semibold disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="text-secondary mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-accent font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
