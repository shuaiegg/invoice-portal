import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { claimPreprovisionedWorker } from "./worker-claim";
import { runPostSignupTasks } from "./signup-after";
import { isRegistrationOpen } from "./app-config";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // Expose User.role on session.user so layouts/pages can gate by role
      // without a DB round-trip. input: false — never settable by the client.
      role: { type: "string", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    // Sessions are DB-backed; the signed cookie cache lets getSession() skip
    // the DB for up to maxAge. A role change on an already-issued session can
    // therefore lag by up to maxAge in page-level gating — API mutations stay
    // authoritative because requireAdmin() re-checks the DB.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // First registered user becomes ADMIN. This must run BEFORE the
        // insert: the session cookie (and its cache) is built from the
        // created row, so promoting after creation would leave the first
        // admin browsing with a stale WORKER role until the cache expires.
        before: async (user) => {
          const userCount = await db.user.count();
          if (userCount === 0) {
            return { data: { ...user, role: "ADMIN" } };
          }

          // Closed-registration gate (openspec/changes/close-worker-registration): once an
          // admin flips AppConfig.registrationOpen off, sign-up only succeeds for an email that
          // already has an unclaimed pre-provisioned Worker. Deliberately the same check
          // claimPreprovisionedWorker performs — a claim-token sign-up (lib/claim-token.ts)
          // always has a matching pending Worker by construction, so it passes this gate for
          // free without needing a bypass flag. Generic message: never reveal whether the
          // rejection was "registration closed" or "email not recognized".
          if (!(await isRegistrationOpen())) {
            const pending = await db.worker.findFirst({
              where: { userId: null, timeDoctorEmail: { equals: user.email, mode: "insensitive" } },
              select: { id: true },
            });
            if (!pending) {
              throw new APIError("FORBIDDEN", { message: "Registration is not available for this account." });
            }
          }
        },
        after: async (user) => {
          await runPostSignupTasks({
            claimWorker: () => claimPreprovisionedWorker(db, { id: user.id, email: user.email }),
            reportClaimError: (error) => console.error("Failed to claim pre-provisioned worker after signup:", error),
          });
        },
      },
    },
  },
});
