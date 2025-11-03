import "server-only";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { adminUsers } from "@/src/schema";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<{ valid: boolean; email?: string }> {
  const normalizedEmail = normalizeEmail(email);

  if (!password) {
    return { valid: false };
  }

  try {
    const results = await db
      .select({
        email: adminUsers.email,
        passwordHash: adminUsers.passwordHash,
        status: adminUsers.status,
      })
      .from(adminUsers)
      .where(sql`LOWER(${adminUsers.email}) = ${normalizedEmail}`)
      .limit(1);

    if (results.length === 0) {
      return { valid: false };
    }

    const user = results[0];

    if (user.status !== "active") {
      return { valid: false };
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return { valid: false };
    }

    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(sql`LOWER(${adminUsers.email}) = ${normalizedEmail}`);

    return { valid: true, email: user.email };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Failed to verify admin password", error);
    }
    return { valid: false };
  }
}
