import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { formatTimestamp } from "@/lib/format";
import CreateUserForm from "./CreateUserForm";
import UsersTable, { type UserRowData } from "./UsersTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users — HCEDP Projects Tracker",
};

export default async function UsersAdminPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  const rows: UserRowData[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "ADMIN" | "USER",
    disabled: u.disabledAt != null,
    lastLoginLabel: u.lastLoginAt ? formatTimestamp(u.lastLoginAt) : "Never",
    isSelf: u.id === admin.id,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Admins manage logins here. General users have full access to the app
          except this page. You can add a teammate from any browser or phone.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add a user</h2>
        <CreateUserForm />
      </div>

      <UsersTable users={rows} />
    </div>
  );
}
