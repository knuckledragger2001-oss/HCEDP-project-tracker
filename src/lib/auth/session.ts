import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Database-backed sessions. The browser only holds an opaque random token in an
// http-only cookie; everything else (validity, expiry, revocation, role) is
// resolved against the Session/User tables on the server.

const COOKIE = "session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type Role = "ADMIN" | "USER" | "PARTNER";
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Set only for PARTNER users: the city this external login is scoped to. */
  partnerCity: string | null;
  /** Version of the last changelog entry this user acknowledged (see changelog.ts). */
  lastSeenChangelog: string | null;
}

// Internal staff (ADMIN or USER) can see the projects tracker and the Placer
// queue. PARTNER is an external, city-scoped login that only sees the Placer
// submission area. This is the one place the internal/external line is drawn.
export function isInternal(role: Role): boolean {
  return role === "ADMIN" || role === "USER";
}

// Create a session for a user and set the cookie. Call only from a Server
// Action or Route Handler (where setting cookies is allowed).
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Destroy the current session (logout).
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
  }
  store.delete(COOKIE);
}

// Resolve the current user from the session cookie, or null. Memoized per
// request so multiple components/pages share one lookup.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    session.user.disabledAt ||
    session.user.deletedAt
  ) {
    return null;
  }
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    partnerCity: u.partnerCity,
    lastSeenChangelog: u.lastSeenChangelog,
  };
});

// Redirect to /login unless authenticated. Use at the top of protected pages.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Require an admin; non-admins are bounced to their home surface.
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homePathFor(user.role));
  return user;
}

// Require internal staff (the projects tracker + Placer queue). Partners are
// sent to their submission area; anonymous users to login.
export async function requireInternal(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isInternal(user.role)) redirect("/requests");
  return user;
}

// Require an external partner (the Placer submission area). Internal users are
// sent back to the tracker; anonymous users to login.
export async function requirePartner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "PARTNER") redirect("/");
  return user;
}

// Where a role lands after login and where a mis-routed request is redirected.
// Partners live under /requests; internal staff start on the pipeline board.
export function homePathFor(role: Role): string {
  return role === "PARTNER" ? "/requests" : "/";
}
