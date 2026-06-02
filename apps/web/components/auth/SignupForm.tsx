"use client";

import { useState } from "react";
import { MdSchool, MdCoPresent } from "react-icons/md";

import { signUp } from "@/lib/actions/auth";

type Role = "student" | "instructor";

export function SignupForm({
  defaultCourseSlug,
}: {
  defaultCourseSlug: string;
}) {
  const [role, setRole] = useState<Role>("student");

  return (
    <form action={signUp} className="flex flex-col gap-3">
      {/* Role toggle */}
      <input type="hidden" name="role" value={role} />
      <div
        role="group"
        aria-label="Account type"
        className="border-divider bg-primary-bg grid grid-cols-2 gap-1 rounded-xl border p-1"
      >
        <RoleButton
          active={role === "student"}
          onClick={() => setRole("student")}
          icon={<MdSchool className="h-4 w-4" />}
          label="I'm a student"
        />
        <RoleButton
          active={role === "instructor"}
          onClick={() => setRole("instructor")}
          icon={<MdCoPresent className="h-4 w-4" />}
          label="I'm a teacher"
        />
      </div>

      <Field label="Name">
        <input
          type="text"
          name="display_name"
          autoComplete="name"
          placeholder="Your name"
          className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
        />
      </Field>

      {role === "student" ? (
        <Field label="Course code (optional)">
          <input
            type="text"
            name="course_slug"
            defaultValue={defaultCourseSlug}
            placeholder="cs-109"
            className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
          />
          <span className="text-secondary text-xs">
            Enter the code your instructor gave you — or join later from your
            dashboard.
          </span>
        </Field>
      ) : (
        <>
          <Field label="Course code">
            <input
              type="text"
              name="course_slug"
              required
              placeholder="cs-109"
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
            <span className="text-secondary text-xs">
              A short code students will use to join your class.
            </span>
          </Field>
          <Field label="Course title">
            <input
              type="text"
              name="course_title"
              placeholder="CS 109: Introduction to Probability"
              className="border-divider focus:outline-primary-accent rounded-lg border px-3 py-2 text-sm"
            />
          </Field>
        </>
      )}

      <button
        type="submit"
        className="bg-primary-accent hover:bg-primary-accent-dark mt-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
      >
        Create account
      </button>
    </form>
  );
}

function RoleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-primary-accent text-white shadow-sm"
          : "text-secondary hover:text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-secondary text-xs font-semibold tracking-widest uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
