"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { CURRENT_VERSION } from "@/lib/changelog";
import { PartnerCityEnum } from "@/lib/placer/schema";

const RoleEnum = z.enum(["ADMIN", "USER", "PARTNER"]);

const CreateUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().trim().optional(),
    role: RoleEnum,
    // Required when role = PARTNER (an external city login); ignored otherwise.
    partnerCity: PartnerCityEnum.optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((d) => d.role !== "PARTNER" || !!d.partnerCity, {
    message: "Choose a city for a partner login.",
    path: ["partnerCity"],
  });

export type CreateUserState = { error?: string; ok?: boolean } | undefined;

// Create a new login. Admin-only.
export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireAdmin();

  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    role: formData.get("role"),
    partnerCity: formData.get("partnerCity") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // The email stays reserved by the unique index even after a soft delete, so
    // spell out that case rather than a generic "already exists".
    return {
      error: existing.deletedAt
        ? "A previously-deleted user has that email. Restore them or use a different email."
        : "A user with that email already exists.",
    };
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name || null,
      role: parsed.data.role,
      // Only partners carry a city; internal logins stay null.
      partnerCity: parsed.data.role === "PARTNER" ? parsed.data.partnerCity : null,
      passwordHash: await hashPassword(parsed.data.password),
      // Start new users caught up so their first login isn't buried under the
      // full changelog backlog — they only see releases shipped after they join.
      lastSeenChangelog: CURRENT_VERSION,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Result shape shared by the admin mutations so the client can toast success or
// surface a specific error.
export type ActionResult = { ok: true } | { ok: false; error: string };

// Enable/disable a login. Disabling also revokes the user's active sessions.
export async function toggleDisabled(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!userId || userId === admin.id) {
    return { ok: false, error: "You cannot disable your own account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return { ok: false, error: "User not found." };

  if (user.disabledAt) {
    await prisma.user.update({ where: { id: userId }, data: { disabledAt: null } });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { disabledAt: new Date() },
    });
    await prisma.session.deleteMany({ where: { userId } });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

// Change a user's role. You cannot change your own role (prevents self-lockout).
// The inline editor only switches between the internal roles (USER/ADMIN);
// partner logins are created via the form. Promoting to PARTNER here is rejected
// because it would leave partnerCity unset (a broken, city-less partner);
// switching a partner back to an internal role clears their city.
export async function setRole(userId: string, roleValue: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const role = RoleEnum.safeParse(roleValue);
  if (!userId || userId === admin.id || !role.success) {
    return { ok: false, error: "You cannot change your own role." };
  }
  if (role.data === "PARTNER") {
    return {
      ok: false,
      error: "Create a partner login from the form above (it needs a city).",
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: role.data, partnerCity: null },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Reset a user's password and force them to sign in again.
export async function resetPassword(userId: string, password: string): Promise<ActionResult> {
  await requireAdmin();
  if (!userId || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Soft delete a login: it can no longer sign in and is hidden from the Users
// page, but the row is preserved so an accidental delete can be undone. Also
// revokes active sessions. You cannot delete your own account.
export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!userId || userId === admin.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Undo a soft delete (the "Undo" action on the delete toast).
export async function restoreUser(userId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!userId) return { ok: false, error: "User not found." };

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Who this user's "Archive to CRM" button auto-CCs (see ArchiveTaskDialog) —
// typically a coverage partner, e.g. two staff who cover each other's
// correspondence. Unlike role/disable/delete this is safe to set on your own
// row, since it carries no access implications.
export async function setCcPartner(
  userId: string,
  ccPartnerId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (!userId) return { ok: false, error: "User not found." };
  if (ccPartnerId === userId) {
    return { ok: false, error: "A user can't be their own CC partner." };
  }
  if (ccPartnerId) {
    const partner = await prisma.user.findUnique({
      where: { id: ccPartnerId },
      select: { role: true, deletedAt: true },
    });
    if (!partner || partner.deletedAt || partner.role === "PARTNER") {
      return { ok: false, error: "The CC partner must be internal staff." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { ccPartnerId } });
  revalidatePath("/admin/users");
  return { ok: true };
}
