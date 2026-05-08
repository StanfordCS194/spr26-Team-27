import { Hono } from "hono";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import db from "./db.ts";
import {
  signToken,
  verifyToken,
  JWT_COOKIE,
} from "./auth-middleware.ts";

const auth = new Hono();

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

auth.post("/signup", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    displayName?: string;
    slug?: string;
  }>();

  const { email, password, displayName, slug } = body;
  if (!email || !password || !displayName || !slug) {
    return c.json({ error: "email, password, displayName, and slug are required" }, 400);
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: "slug must be lowercase alphanumeric with hyphens" }, 400);
  }

  if (password.length < 6) {
    return c.json({ error: "password must be at least 6 characters" }, 400);
  }

  const existing = db
    .prepare("SELECT id FROM instructors WHERE email = ? OR slug = ?")
    .get(email, slug) as { id: string } | undefined;
  if (existing) {
    return c.json({ error: "email or slug already taken" }, 409);
  }

  const id = randomBytes(16).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt) + ":" + salt;

  db.prepare(
    "INSERT INTO instructors (id, email, password_hash, display_name, slug) VALUES (?, ?, ?, ?, ?)",
  ).run(id, email, passwordHash, displayName, slug);

  const courseId = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO courses (id, instructor_id, name) VALUES (?, ?, ?)",
  ).run(courseId, id, `${displayName}'s Course`);

  const token = await signToken({ sub: id, email, slug });
  c.header(
    "set-cookie",
    `${JWT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
  );
  return c.json({ id, email, displayName, slug });
});

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const { email, password } = body;
  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const row = db
    .prepare("SELECT id, email, password_hash, display_name, slug FROM instructors WHERE email = ?")
    .get(email) as
    | { id: string; email: string; password_hash: string; display_name: string; slug: string }
    | undefined;
  if (!row) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  const [storedHash, salt] = row.password_hash.split(":");
  const attemptHash = hashPassword(password, salt);
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(attemptHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  const token = await signToken({ sub: row.id, email: row.email, slug: row.slug });
  c.header(
    "set-cookie",
    `${JWT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
  );
  return c.json({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    slug: row.slug,
  });
});

auth.get("/me", async (c) => {
  const cookie = c.req.header("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)inlecture_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return c.json({ instructor: null });

  const payload = await verifyToken(token);
  if (!payload) return c.json({ instructor: null });

  const row = db
    .prepare("SELECT id, email, display_name, slug FROM instructors WHERE id = ?")
    .get(payload.sub) as
    | { id: string; email: string; display_name: string; slug: string }
    | undefined;
  if (!row) return c.json({ instructor: null });

  return c.json({
    instructor: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      slug: row.slug,
    },
  });
});

auth.post("/logout", (c) => {
  c.header(
    "set-cookie",
    `${JWT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return c.json({ ok: true });
});

export default auth;
