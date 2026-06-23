import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";

// Ensures the bootstrap admin account exists, from the ADMIN_EMAIL /
// ADMIN_PASSWORD environment variables. Runs on server startup (see
// src/instrumentation.ts). The admin login therefore always lives in the
// host's environment (Railway), exactly like the old shared password — and if
// you ever get locked out, change those two variables and redeploy to reset it.
//
// On every boot the password is re-synced to the env value, so rotating the env
// var rotates the admin password. Other users are created in-app by an admin.
export async function ensureAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[auth] ADMIN_EMAIL / ADMIN_PASSWORD not set — no bootstrap admin created. " +
        "Set both to enable login.",
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", disabledAt: null },
    create: { email, name: "Administrator", passwordHash, role: "ADMIN" },
  });
  console.log(`[auth] Bootstrap admin ensured for ${email}`);
}
