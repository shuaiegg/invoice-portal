import { PrismaClient } from "./generated/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const environment = process.env.WEBHOOK_ENVIRONMENT || "production";

const defaults = [
  {
    key: "invoice.submitted",
    environment,
    url: process.env.N8N_INVOICE_SUBMITTED_URL || "https://your-n8n-instance/webhook/invoice-submit",
    enabled: true,
  },
  {
    key: "invoice.updated",
    environment,
    url: process.env.N8N_INVOICE_UPDATED_URL || "https://your-n8n-instance/webhook/invoice-submit",
    enabled: true,
  },
];

async function seed() {
  for (const config of defaults) {
    await db.webhookConfig.upsert({
      where: { key_environment: { key: config.key, environment: config.environment } },
      update: {},
      create: config,
    });
    console.log(`✓ ${config.key} (${config.environment})`);
  }
  console.log("Webhook configs seeded.");
  await db.$disconnect();
}

seed().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
