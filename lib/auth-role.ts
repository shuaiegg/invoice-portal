import { db } from "./db";

// Authoritative role check against the DB. Use this for API routes that
// mutate state (see lib/admin-guard.ts). Layouts and pages should read
// `session.user.role` instead — it is embedded in the session via
// `user.additionalFields` in lib/auth.ts and served from the cookie cache,
// so it costs no DB round-trip but can lag a role change by up to the
// cookieCache maxAge.
export async function isAdminUser(userId: string): Promise<boolean> {
  const dbUser = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return dbUser?.role === "ADMIN";
}
