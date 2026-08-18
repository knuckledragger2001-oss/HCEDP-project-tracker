import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listNotifications, unreadNotificationCount } from "@/lib/notifications/notify";
import { syncPlacerSchedule } from "@/lib/placer/planning";

export const runtime = "nodejs";

// GET /api/notifications — the bell's feed. Polled by the client (see
// NotificationBell), so this is also where the throttled Placer schedule sync
// (release due plans, raise due-date reminders) actually gets driven from —
// every signed-in internal user's browser ends up calling it regularly, which
// is exactly the cadence a scheduler would give us, without needing one.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  await syncPlacerSchedule();

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id),
    unreadNotificationCount(user.id),
  ]);

  return NextResponse.json({ notifications, unread });
}
