import { db } from "./db";

async function main() {
  const configs = [
    {
      key: "invoice.submitted",
      environment: "production",
      url: "https://n8n.example.com/webhook/invoice-submitted",
      enabled: true,
      internalSecret: "prod-internal-secret-1234567890",
    },
    {
      key: "invoice.submitted",
      environment: "development",
      url: "http://localhost:5678/webhook-test/invoice-submitted",
      enabled: true,
      internalSecret: "dev-internal-secret-1234567890",
    },
    {
      key: "invoice.updated",
      environment: "production",
      url: "https://n8n.example.com/webhook/invoice-updated",
      enabled: true,
      internalSecret: "prod-internal-secret-1234567890",
    },
    {
      key: "invoice.updated",
      environment: "development",
      url: "http://localhost:5678/webhook-test/invoice-updated",
      enabled: true,
      internalSecret: "dev-internal-secret-1234567890",
    },
  ];

  console.log("Seeding WebhookConfigs...");

  for (const config of configs) {
    await db.webhookConfig.upsert({
      where: {
        key_environment: {
          key: config.key,
          environment: config.environment,
        },
      },
      update: config,
      create: config,
    });
    console.log(`- Seeded ${config.key} (${config.environment})`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Note: db might not be disconnectable if it's a singleton without $disconnect
  });
