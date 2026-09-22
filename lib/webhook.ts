import { db } from "./db";

export function dispatchWebhook(
  key: string,
  payload: object,
  environment = process.env.WEBHOOK_ENVIRONMENT || process.env.NODE_ENV || "development"
): void {
  db.webhookConfig
    .findUnique({
      where: { key_environment: { key, environment } },
    })
    .then((config) => {
      if (!config || !config.enabled) return;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.secret) headers["X-Webhook-Secret"] = config.secret;

      fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventKey: key,
          ...payload,
          timestamp: new Date().toISOString(),
          environment,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            console.error(`Webhook dispatch returned ${res.status} for key ${key}`);
            return;
          }
          // Lets Admin Settings show "last triggered" per event key — the only way
          // to confirm an event actually fired without digging through n8n's logs.
          return db.webhookConfig.update({
            where: { key_environment: { key, environment } },
            data: { lastTriggeredAt: new Date() },
          });
        })
        .catch((err) => {
          console.error(`Webhook dispatch failed for key ${key}:`, err);
        });
    })
    .catch((err) => {
      console.error(`Failed to fetch webhook config for key ${key}:`, err);
    });
}
