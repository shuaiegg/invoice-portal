export type PayrollSummaryRow = {
  name: string;
  email: string;
  currency: string;
  hourlyRate: number;
  paymentMethod: string;
};

export const WORKER_IMPORT_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 300_000,
} as const;

// Managed Postgres providers (Neon included) can silently close a pooled connection that's sat
// idle for a while; the client only discovers this on the next query, surfacing as "Connection
// terminated unexpectedly" / ECONNRESET. This is unrelated to how long any one transaction takes
// (a fresh, cold connection can die on its very first query) — retrying is the standard mitigation.
export function isTransientConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /connection.*terminated|econnreset|connection.*closed|connection.*reset/i.test(message);
}

export async function withConnectionRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 500 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isTransientConnectionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || record.length) {
    record.push(field.trim());
    if (record.some(Boolean)) records.push(record);
  }
  if (quoted) throw new Error("Invalid CSV: unterminated quoted field");
  return records;
}

export function parsePayrollSummaryCsv(input: string): PayrollSummaryRow[] {
  const records = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  const headers = records.shift();
  if (!headers) throw new Error("CSV is empty");

  const required = ["Name", "Email", "Currency", "Hourly rate", "Payment method"] as const;
  const indexes = Object.fromEntries(required.map((header) => [header, headers.indexOf(header)]));
  for (const header of required) {
    if (indexes[header] === -1) throw new Error(`Missing required CSV column: ${header}`);
  }

  return records.map((record, rowIndex) => {
    const hourlyRate = Number(record[indexes["Hourly rate"]]);
    const email = record[indexes.Email]?.trim().toLowerCase();
    if (!email || !Number.isFinite(hourlyRate) || hourlyRate < 0) {
      throw new Error(`Invalid payroll data on CSV row ${rowIndex + 2}`);
    }
    return {
      name: record[indexes.Name]?.trim() || email,
      email,
      currency: record[indexes.Currency]?.trim().toUpperCase(),
      hourlyRate,
      paymentMethod: record[indexes["Payment method"]]?.trim(),
    };
  });
}

export function paymentAccountTypeForTdMethod(method: string): "WISE" | "PAYPAL" | null {
  const normalized = method.trim().toLowerCase();
  if (normalized === "wise") return "WISE";
  if (normalized === "paypal") return "PAYPAL";
  return null;
}

// Every TD-tracked worker gets TD_PLUS: hours are pulled from TD automatically and the
// invoice lands as a DRAFT the worker reviews and submits — one uniform flow regardless of
// payment rail (product decision 2026-07-16; the earlier Wise→TD_ONLY auto-submit split
// confused finance). Portal's MANUAL paymentType is intentionally never set here — it's
// reserved for workers outside TD entirely, who self-report hours with no TD sync at all.
export const TD_IMPORT_PAYMENT_TYPE = "TD_PLUS" as const;

export function decideRateImport(
  source: "TD_IMPORT" | "MANUAL",
  portalRate: number | null,
  importedRate: number,
): "overwrite" | "reconcile" | "conflict" {
  if (source === "TD_IMPORT") return "overwrite";
  return portalRate === importedRate ? "reconcile" : "conflict";
}
