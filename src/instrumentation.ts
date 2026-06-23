// Next.js runs register() once when the server starts. We use it to ensure the
// bootstrap admin account exists from the ADMIN_EMAIL / ADMIN_PASSWORD env vars.
export async function register() {
  // Only run in the Node.js server runtime (not the edge/proxy runtime).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAdminUser } = await import("@/lib/auth/bootstrap");
    try {
      await ensureAdminUser();
    } catch (err) {
      // Don't crash startup if the DB isn't reachable yet — login will simply
      // fail until it is, and the next boot retries.
      console.error("[auth] Admin bootstrap failed:", err);
    }
  }
}
