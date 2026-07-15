import { PrismaClient } from "./generated/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prismaPgV2: PrismaClient | undefined };

const connectionString = process.env.DATABASE_URL;

// keepAlive mitigates cloud-network infrastructure (NAT/load balancers) silently dropping
// connections that look idle mid-query — a common cause of Postgres's "Connection terminated
// unexpectedly" on managed providers like Neon, especially for longer-running transactions.
const pool = new pg.Pool({ connectionString, keepAlive: true });
const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prismaPgV2 ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaPgV2 = db;
