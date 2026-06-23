"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

const RoleEnum = z.enum(["ADMIN", "USER"]);

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().optional(),
  role: RoleEnum,
  password: z.string().min(8, "Password must be at least 8 characters."),
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
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name || null,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// Enable/disable a login. Disabling also revokes the user's active sessions.
export async function toggleDisabled(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) return; // never disable yourself

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

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
}

// Change a user's role. You cannot change your own role (prevents self-lockout).
export async function setRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = RoleEnum.safeParse(formData.get("role"));
  if (!userId || userId === admin.id || !role.success) return;

  await prisma.user.update({ where: { id: userId }, data: { role: role.data } });
  revalidatePath("/admin/users");
}

// Reset a user's password and force them to sign in again.
export async function resetPassword(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId || password.length < 8) return;

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
}

// Permanently delete a login. You cannot delete your own account.
export async function deleteUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === admin.id) return;

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
