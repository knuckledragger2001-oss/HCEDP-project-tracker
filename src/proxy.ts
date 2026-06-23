import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed "middleware" to "proxy" (same behavior). This runs on
// every matched request and does an OPTIMISTIC auth check: it only looks at
// whether a session cookie is present (no database call here, per Next.js
// guidance). The authoritative check — validating the session against the
// database and resolving the user's role — happens in the root layout via the
// data-access layer (src/lib/auth/session.ts).

const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("session")?.value);

  // Expose the current path to server components (the layout reads this to know
  // whether it's rendering the public /login page vs. a protected page).
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);

  // Not signed in and asking for a protected page → send to login.
  if (!hasSession && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in but on the login page → send to the board.
  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
