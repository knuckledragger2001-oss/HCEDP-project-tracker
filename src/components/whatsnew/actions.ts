"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CURRENT_VERSION } from "@/lib/changelog";

// Mark the signed-in user as caught up to the latest changelog entry. Called
// when they dismiss the "What's new" dialog. The version is resolved on the
// server (never trusted from the client) so a user can only ever mark themselves
// current, and only for their own account.
export async function markChangelogSeen(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenChangelog: CURRENT_VERSION },
  });
}
