import { PrismaClient } from "./generated/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prismaPgV2: PrismaClient | undefined };

const connectionString = process.env.DATABASE_URL;

// Neon's pgbouncer closes idle connections after ~5 minutes. idleTimeoutMillis evicts
// pool connections before Neon terminates them, preventing "Connection terminated
// unexpectedly". keepAlive prevents NAT/load-balancer silent drops mid-query.
const pool = new pg.Pool({
  connectionString,
  keepAlive: true,
  idleTimeoutMillis: 20000,    // evict idle connections after 20s (before Neon's ~5min)
  connectionTimeoutMillis: 10000,
  max: 5,                      // cap pool size for serverless — Neon free tier allows 5
});

// Remove terminated connections from the pool immediately so the next acquire
// gets a fresh connection rather than reusing the dead one.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prismaPgV2 ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaPgV2 = db;
