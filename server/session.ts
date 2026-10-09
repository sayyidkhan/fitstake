import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getSessionUser, type AuthUser } from "./auth.js";
import { db } from "./db/client.js";
import { HttpError } from "./service.js";

export const SESSION_COOKIE = "fs_session";
export type Env = { Variables: { user: AuthUser } };

const secure = (c: Context) => c.req.url.startsWith("https://") || Boolean(process.env.VERCEL);

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, // not readable by page scripts
    secure: secure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
}

export const clearSessionCookie = (c: Context) => deleteCookie(c, SESSION_COOKIE, { path: "/", secure: secure(c) });
export const sessionToken = (c: Context) => getCookie(c, SESSION_COOKIE);

// Loads the logged-in user (if any) from the session cookie.
export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const user = await getSessionUser(db, sessionToken(c));
  if (!user) throw new HttpError(401, "Please log in to continue.");
  c.set("user", user);
  await next();
};

// Blocks cross-site form posts: a browser-sent Origin must match this site.
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
    if (origin && host) {
      let ok = false;
      try {
        ok = new URL(origin).host === host;
      } catch {
        ok = false;
      }
      if (!ok) throw new HttpError(403, "Cross-site request blocked.");
    }
  }
  await next();
};
