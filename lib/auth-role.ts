import { db } from "./db";

// BetterAuth doesn't put a `role` field on the session/JWT by default — nothing in lib/auth.ts
// adds it as a custom session field, so `session.user.role` is always undefined regardless of
// the signed-in user's actual role. Role must always come from a DB lookup. Centralized here
// after finding the same `(session.user as any).role` bug independently copy-pasted into four
// different files, each silently always evaluating to false.
export async function isAdminUser(userId: string): Promise<boolean> {
  const dbUser = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return dbUser?.role === "ADMIN";
}
