import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    strategy: "jwt",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const userCount = await db.user.count();
          if (userCount === 1) {
            await db.user.update({
              where: { id: user.id },
              data: { role: "ADMIN" },
            });
          }
        },
      },
    },
  },
});
