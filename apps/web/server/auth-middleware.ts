import { createMiddleware } from "hono/factory";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "inlecture-dev-secret-change-in-prod",
);

export const JWT_ALG = "HS256";
export const JWT_COOKIE = "inlecture_token";

export interface AuthPayload {
  sub: string;
  email: string;
  slug: string;
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export const requireAuth = createMiddleware<{
  Variables: { instructor: AuthPayload };
}>(async (c, next) => {
  const cookie = c.req.header("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)inlecture_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const payload = await verifyToken(token);
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  c.set("instructor", payload);
  await next();
});
