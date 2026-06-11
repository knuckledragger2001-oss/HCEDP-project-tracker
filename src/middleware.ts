import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  // Auth is opt-in: if env vars are not set the app runs unprotected (local dev).
  if (!expectedUser || !expectedPass) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colonAt = decoded.indexOf(":");
      const user = decoded.slice(0, colonAt);
      const pass = decoded.slice(colonAt + 1);
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="HCEDP Projects Tracker"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
