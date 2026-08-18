"use client";

// Client-side action layer for the Users admin table. Data is still fetched on
// the server; this component adds the confirm-before-acting and toast feedback
// that the raw server-action forms lacked. Destructive/security-sensitive
// actions (delete, disable, reset password, role change) route through a confirm
// dialog; delete is a soft delete with an Undo toast.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import {
  toggleDisabled,
  setRole,
  resetPassword,
  deleteUser,
  restoreUser,
  setCcPartner,
  type ActionResult,
} from "./actions";

export type UserRowData = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER" | "PARTNER";
  /** City label for PARTNER rows; null for internal users. */
  cityLabel: string | null;
  disabled: boolean;
  lastLoginLabel: string;
  isSelf: boolean;
  /** Who this user's "Archive to CRM" button auto-CCs; null if unset. */
  ccPartnerId: string | null;
};

export type InternalUserOption = { id: string; label: string };

export default function UsersTable({
  users,
  internalUsers,
}: {
  users: UserRowData[];
  internalUsers: InternalUserOption[];
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-muted">
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">User</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">Role</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">Status</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">Last login</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">Auto-CC partner</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5">Reset password</th>
            <th scope="col" className="border-b border-line bg-green-tint px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} internalUsers={internalUsers} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  user: u,
  internalUsers,
}: {
  user: UserRowData;
  internalUsers: InternalUserOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [role, setRoleValue] = useState<"ADMIN" | "USER">(
    u.role === "ADMIN" ? "ADMIN" : "USER",
  );
  const [password, setPassword] = useState("");
  const [ccPartnerId, setCcPartnerId] = useState(u.ccPartnerId ?? "");

  // Run a server action, surface the result as a toast, and refresh on success.
  async function run(
    action: () => Promise<ActionResult>,
    successMessage: string,
    opts?: { onSuccess?: () => void; undo?: () => Promise<ActionResult> },
  ) {
    setBusy(true);
    try {
      const res = await action();
      if (res.ok) {
        opts?.onSuccess?.();
        router.refresh();
        toast.success(successMessage, {
          action: opts?.undo
            ? {
                label: "Undo",
                onClick: async () => {
                  const r = await opts.undo!();
                  router.refresh();
                  if (r.ok) toast.info("Restored.");
                  else toast.error(r.error);
                },
              }
            : undefined,
        });
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onApplyRole() {
    if (role === u.role) return;
    const ok = await confirm({
      title: `Change ${u.email} to ${role}?`,
      description:
        role === "ADMIN"
          ? "Admins can manage users, including deleting other admins."
          : "They will lose access to user management.",
      confirmLabel: "Change role",
    });
    if (ok) await run(() => setRole(u.id, role), `Role changed to ${role}.`);
  }

  async function onResetPassword() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    const ok = await confirm({
      title: `Reset ${u.email}'s password?`,
      description: "They will be signed out of all devices and must use the new password.",
      confirmLabel: "Reset password",
    });
    if (ok)
      await run(() => resetPassword(u.id, password), "Password reset.", {
        onSuccess: () => setPassword(""),
      });
  }

  async function onToggleDisabled() {
    if (!u.disabled) {
      const ok = await confirm({
        title: `Disable ${u.email}?`,
        description: "They will be signed out immediately and cannot log in until re-enabled.",
        confirmLabel: "Disable",
        tone: "danger",
      });
      if (!ok) return;
    }
    await run(() => toggleDisabled(u.id), u.disabled ? "User enabled." : "User disabled.");
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${u.email}?`,
      description: "They lose access immediately. You can undo this right after.",
      confirmLabel: "Delete user",
      tone: "danger",
    });
    if (ok)
      await run(() => deleteUser(u.id), `Deleted ${u.email}.`, {
        undo: () => restoreUser(u.id),
      });
  }

  async function onApplyCcPartner() {
    if (ccPartnerId === (u.ccPartnerId ?? "")) return;
    await run(() => setCcPartner(u.id, ccPartnerId || null), "Auto-CC partner updated.");
  }

  return (
    <tr className="border-b border-line align-top transition-colors last:border-0 hover:bg-surface-2">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">
          {u.name ?? "—"}
          {u.isSelf && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
        </div>
        <div className="text-xs text-muted">{u.email}</div>
      </td>
      <td className="px-4 py-3">
        {u.role === "PARTNER" ? (
          // External city logins aren't re-roled inline (that would strand their
          // city) — shown as a read-only Partner badge with the city.
          <span className="badge bg-accent/15 text-accent-dark">
            Partner · {u.cityLabel ?? "—"}
          </span>
        ) : u.isSelf ? (
          <span className="badge bg-brand/10 text-brand">{u.role}</span>
        ) : (
          <div className="flex items-center gap-1">
            <select
              value={role}
              onChange={(e) => setRoleValue(e.target.value as "ADMIN" | "USER")}
              className="input h-8 w-auto py-1 text-xs"
              disabled={busy}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              className="text-xs text-brand hover:underline disabled:opacity-50"
              onClick={onApplyRole}
              disabled={busy || role === u.role}
            >
              Apply
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {u.disabled ? (
          <span className="badge bg-danger/15 text-danger">Disabled</span>
        ) : (
          <span className="badge bg-success/15 text-success">Active</span>
        )}
      </td>
      <td className="mono px-4 py-3 text-muted">{u.lastLoginLabel}</td>
      <td className="px-4 py-3">
        {u.role === "PARTNER" ? (
          <span className="text-xs text-muted/60">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <select
              value={ccPartnerId}
              onChange={(e) => setCcPartnerId(e.target.value)}
              className="input h-8 w-auto py-1 text-xs"
              disabled={busy}
            >
              <option value="">None</option>
              {internalUsers
                .filter((o) => o.id !== u.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
            <button
              className="text-xs text-brand hover:underline disabled:opacity-50"
              onClick={onApplyCcPartner}
              disabled={busy || ccPartnerId === (u.ccPartnerId ?? "")}
            >
              Apply
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {u.isSelf ? (
          <span className="text-xs text-muted/60">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              minLength={8}
              placeholder="new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input h-8 w-36 py-1 text-xs"
              disabled={busy}
            />
            <button
              className="text-xs text-brand hover:underline disabled:opacity-50"
              onClick={onResetPassword}
              disabled={busy}
            >
              Set
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {u.isSelf ? (
          <span className="flex justify-end text-xs text-muted/60">—</span>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button
              className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
              onClick={onToggleDisabled}
              disabled={busy}
            >
              {u.disabled ? "Enable" : "Disable"}
            </button>
            <button
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
              onClick={onDelete}
              disabled={busy}
            >
              <TrashIcon className="text-sm" />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
