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
  timeDoctorEmail?: string | null;
  paymentType?: string;
  user?: {
    email?: string | null;
  } | null;
};

export function tdWorkerInvite(worker: SlackWorker): void {
  const registrationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/register`;
  notifySlack({
    text: [
      `Invoice Portal invitation for ${worker.name}`,
      worker.timeDoctorEmail ? `Time Doctor email: ${worker.timeDoctorEmail}` : null,
      `Register to claim your pre-configured worker profile: ${registrationUrl}`,
    ].filter(Boolean).join("\n"),
  });
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

export function tdPlusDraftReady(invoice: SlackInvoice, worker: SlackWorker): void {
  notifySlack({ text: `Your invoice for ${invoice.period} is ready, ${worker.name}. Please review and add any additional items, then submit.` });
}

export function tdSyncSummary(result: { invoicesCreated: number; totalAmount: number; matchFailed: number; inactiveSkipped: number; ignoredSkipped: number }): void {
  notifySlack({ text: `${result.invoicesCreated} invoices generated · €${result.totalAmount.toFixed(2)} total · ${result.matchFailed} unmatched · ${result.inactiveSkipped} inactive skipped · ${result.ignoredSkipped} ignored` });
}

export function tdSyncFailure(): void {
  notifySlack({ text: "🔴 TD sync failed to start this month — check /admin/settings/timedoctor; the TD token may need reconnecting." });
}
