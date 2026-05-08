import { useCallback, useEffect, useState } from "react";

export interface Instructor {
  id: string;
  email: string;
  displayName: string;
  slug: string;
}

export function useAuth() {
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { instructor: Instructor | null }) => {
        setInstructor(data.instructor);
      })
      .catch(() => setInstructor(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setInstructor(null);
  }, []);

  return { instructor, loading, logout, setInstructor };
}
