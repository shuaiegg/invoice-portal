import { db } from "./db";

/**
 * Dispatches a fire-and-forget webhook to n8n.
 * Reads configuration from the WebhookConfig table.
 * Does not block the main execution flow.
 */
export function dispatchWebhook(
  key: string,
  payload: object,
  environment = process.env.WEBHOOK_ENVIRONMENT || process.env.NODE_ENV || "development"
): void {
  // We don't await this because it's fire-and-forget
  db.webhookConfig
    .findUnique({
      where: {
        key_environment: {
          key,
          environment,
        },
      },
    })
    .then((config) => {
      if (!config || !config.enabled) {
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.secret) {
        headers["X-Webhook-Secret"] = config.secret;
      }

      // Fire the fetch and swallow any errors
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
