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
  // New event keys from the Slack -> WebhookConfig unification. Seeded disabled with a
  // placeholder URL so they don't fire fetches until an admin sets a real n8n URL and
  // flips them on via Admin Settings.
  { key: "invoice.revoked", environment, url: "https://your-n8n-instance/webhook/invoice-revoked", enabled: false },
  { key: "invoice.status_changed", environment, url: "https://your-n8n-instance/webhook/invoice-status-changed", enabled: false },
  { key: "invoice.paid", environment, url: "https://your-n8n-instance/webhook/invoice-paid", enabled: false },
  { key: "invoice.changes_requested", environment, url: "https://your-n8n-instance/webhook/invoice-changes-requested", enabled: false },
  { key: "invoice.bulk_completed", environment, url: "https://your-n8n-instance/webhook/invoice-bulk-completed", enabled: false },
  { key: "worker.invited", environment, url: "https://your-n8n-instance/webhook/worker-invited", enabled: false },
  { key: "td.sync_completed", environment, url: "https://your-n8n-instance/webhook/td-sync-completed", enabled: false },
  { key: "td.sync_failed", environment, url: "https://your-n8n-instance/webhook/td-sync-failed", enabled: false },
  { key: "td.draft_ready", environment, url: "https://your-n8n-instance/webhook/td-draft-ready", enabled: false },
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
