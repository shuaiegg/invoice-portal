import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load .env.local first (Next.js convention), then fall back to .env
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
