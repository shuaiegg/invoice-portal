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
      }).catch((err) => {
        console.error(`Webhook dispatch failed for key ${key}:`, err);
      });
    })
    .catch((err) => {
      console.error(`Failed to fetch webhook config for key ${key}:`, err);
    });
}
