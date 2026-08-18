import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, isInternal, type SessionUser } from "@/lib/auth/session";

// The gate every internal-only route handler opens with. Pages use
// requireInternal() (which redirects); an API has to answer with a status code,
// so this returns either the user or the response to send back.
//
//   const gate = await requireInternalApi();
//   if (gate.error) return gate.error;
//   const user = gate.user;

export type InternalGate =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

export async function requireInternalApi(): Promise<InternalGate> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (!isInternal(user.role)) {
    return { error: NextResponse.json({ error: "Staff only." }, { status: 403 }) };
  }
  return { user };
}
