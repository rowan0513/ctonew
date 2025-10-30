import "server-only";

import bcrypt from "bcryptjs";

import { env } from "@/env.mjs";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfiguredAdminEmail(): string {
  return normalizeEmail(env.ADMIN_EMAIL);
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const expectedEmail = getConfiguredAdminEmail();

  if (normalizedEmail !== expectedEmail) {
    return false;
  }

  if (!password) {
    return false;
  }

  try {
    return await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Failed to verify admin password", error);
    }
    return false;
  }
}
