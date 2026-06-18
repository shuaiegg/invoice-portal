export interface SlackMessage {
  text: string;
  blocks?: any[];
}

/**
 * Fires a fire-and-forget notification to Slack using an Incoming Webhook.
 * Swallows errors to ensure main execution flow is not blocked.
 */
export function notifySlack(payload: SlackMessage): void {
  const url = process.env.SLACK_WEBHOOK_URL;
  
  if (!url) {
    console.warn("SLACK_WEBHOOK_URL is not set. Skipping notification.");
    return;
  }

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("Slack notification failed:", err);
  });
}
