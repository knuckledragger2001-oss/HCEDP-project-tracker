import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import CreateUserForm from "./CreateUserForm";
import { toggleDisabled, setRole, resetPassword, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users — HCEDP Projects Tracker",
};

export default async function UsersAdminPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Admins manage logins here. General users have full access to the app
          except this page. You can add a teammate from any browser or phone.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Add a user</h2>
        <CreateUserForm />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last login</th>
              <th className="px-4 py-2">Reset password</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === admin.id;
              return (
                <tr key={u.id} className="border-b border-gray-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {u.name ?? "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="badge bg-brand/10 text-brand">
                        {u.role}
                      </span>
                    ) : (
                      <form action={setRole} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="input h-8 w-auto py-1 text-xs"
                        >
                          <option value="USER">User</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button className="text-xs text-brand hover:underline">
                          Apply
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.disabledAt ? (
                      <span className="badge bg-red-100 text-red-700">
                        Disabled
                      </span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={resetPassword} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        name="password"
                        type="text"
                        minLength={8}
                        placeholder="new password"
                        className="input h-8 w-36 py-1 text-xs"
                      />
                      <button className="text-xs text-brand hover:underline">
                        Set
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <form action={toggleDisabled}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button className="text-xs text-gray-600 hover:underline">
                            {u.disabledAt ? "Enable" : "Disable"}
                          </button>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button className="text-xs text-red-600 hover:underline">
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
