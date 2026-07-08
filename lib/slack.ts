export interface SlackMessage {
  text: string;
  blocks?: unknown[];
}

type SlackInvoice = {
  invoiceNumber: string;
  period: string;
  totalAmount: number;
  currency: string;
};

type SlackWorker = {
  name: string;
  paymentType?: string;
  user?: {
    email?: string | null;
  } | null;
};

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

export function invoiceSubmitted(invoice: SlackInvoice, worker: SlackWorker): void {
  notifySlack({
    text: [
      "New invoice created",
      `Worker: ${worker.name}`,
      `Period: ${invoice.period}`,
      `Amount: ${invoice.totalAmount} ${invoice.currency}`,
      `Invoice #: ${invoice.invoiceNumber}`,
    ].join("\n"),
  });
}

export function invoiceStatusChanged(
  invoice: SlackInvoice,
  worker: SlackWorker,
  oldStatus: string,
  newStatus: string,
): void {
  notifySlack({
    text: [
      "Invoice status changed",
      `Worker: ${worker.name}`,
      `Invoice #: ${invoice.invoiceNumber}`,
      `Status: ${oldStatus} -> ${newStatus}`,
      `Amount: ${invoice.totalAmount} ${invoice.currency}`,
    ].join("\n"),
  });
}

export function invoiceUpdated(invoice: SlackInvoice, worker: SlackWorker): void {
  notifySlack({
    text: [
      "Invoice updated",
      `Worker: ${worker.name}`,
      `Invoice #: ${invoice.invoiceNumber}`,
      `Period: ${invoice.period}`,
      `Amount: ${invoice.totalAmount} ${invoice.currency}`,
      "Xero: Updated ✅",
    ].join("\n"),
  });
}

export function invoicePaidWorkerNotification(invoice: SlackInvoice, worker: SlackWorker): void {
  notifySlack({
    text: [
      "Manual invoice marked as paid",
      `Worker: ${worker.name}${worker.user?.email ? ` (${worker.user.email})` : ""}`,
      `Invoice #: ${invoice.invoiceNumber}`,
      `Period: ${invoice.period}`,
      `Amount: ${invoice.totalAmount} ${invoice.currency}`,
    ].join("\n"),
  });
}
