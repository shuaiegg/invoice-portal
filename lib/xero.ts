import { db } from "./db";
import { Invoice, InvoiceLine, Worker } from "./generated/client/client";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

// Xero enforces 60 calls/min per tenant. On 429 it sends Retry-After (seconds);
// waiting it out and retrying turns a rate-limit failure into a slower success.
async function xeroFetch(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt >= retries) return response;
    const retryAfter = Math.min(Number(response.headers.get("Retry-After")) || 5, 60);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
}

// Turn Xero's opaque failures into actionable messages. 403 AuthenticationUnsuccessful
// with a fresh token means the organisation connection was removed on Xero's side
// (Connected apps → disconnect, or a reset demo company) — refreshing can't fix that.
// Pull the first human-readable validation message out of Xero's nested error shape
function xeroValidationDetail(errorData: unknown): string {
  const data = errorData as { Detail?: string; Message?: string; Elements?: Array<{ ValidationErrors?: Array<{ Message?: string }> }> };
  return data?.Elements?.flatMap((el) => el.ValidationErrors ?? []).find((v) => v.Message)?.Message
    ?? data?.Detail
    ?? data?.Message
    ?? "";
}

function xeroFailureMessage(operation: string, status: number, errorData: unknown): string {
  const detail = xeroValidationDetail(errorData);
  if (status === 403 && /AuthenticationUnsuccessful/i.test(detail)) {
    return `${operation} failed: the Xero organisation is no longer connected to this app. Reconnect Xero in Admin Settings, then retry the sync.`;
  }
  if (status === 429) {
    return `${operation} failed: Xero rate limit hit. Retry the failed syncs in a minute.`;
  }
  return `${operation} failed (Xero responded ${status}${detail ? ` — ${detail}` : ""}).`;
}

export async function getAccessToken(): Promise<string> {
  const token = await db.xeroToken.findUnique({
    where: { id: "singleton" },
  });

  if (!token) {
    throw new Error("Xero account not connected. Please go to Admin Settings to connect Xero.");
  }

  const now = new Date();
  // Refresh if expired or expiring in less than 2 minutes
  if (token.tokenExpiry.getTime() > now.getTime() + 120000) {
    return token.accessToken;
  }

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Xero token refresh failed:", errorData);
    throw new Error("Failed to refresh Xero token. Connection might be lost.");
  }

  const data = await response.json();
  const updatedToken = await db.xeroToken.update({
    where: { id: "singleton" },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return updatedToken.accessToken;
}

export async function getTenantId(): Promise<string> {
  const token = await db.xeroToken.findUnique({
    where: { id: "singleton" },
    select: { tenantId: true },
  });
  
  if (token?.tenantId) return token.tenantId;

  // Fallback to fetching it if not stored for some reason
  const accessToken = await getAccessToken();
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Xero connections.");
  }

  const connections = await response.json();
  if (!connections || connections.length === 0) {
    throw new Error("No Xero tenants found for this connection.");
  }

  // Update DB with the found tenantId
  await db.xeroToken.update({
    where: { id: "singleton" },
    data: { tenantId: connections[0].tenantId },
  });

  return connections[0].tenantId;
}

export async function upsertXeroContact(
  accessToken: string,
  tenantId: string,
  worker: Worker
): Promise<string> {
  const user = worker.userId
    ? await db.user.findUnique({
        where: { id: worker.userId },
        select: { email: true },
      })
    : null;
  const workerEmail = user?.email || worker.timeDoctorEmail || "";

  // 1. Search for contact by email
  const searchResponse = await xeroFetch(
    `${XERO_API_BASE}/Contacts?where=EmailAddress%3D%3D%22${encodeURIComponent(workerEmail)}%22`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": tenantId,
        Accept: "application/json",
      },
    }
  );

  let contactId: string | null = null;
  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.Contacts && searchData.Contacts.length > 0) {
      contactId = searchData.Contacts[0].ContactID;
    }
  }

  // 2. Upsert Contact
  const contactBody = {
    Contacts: [
      {
        ContactID: contactId || undefined,
        Name: worker.name,
        EmailAddress: workerEmail,
        TaxNumber: worker.vatNumber,
        Addresses: [
          {
            AddressType: "STREET",
            AddressLine1: worker.address,
            City: worker.city,
            PostalCode: worker.postCode,
            Country: worker.country,
          },
        ],
      },
    ],
  };

  const upsertResponse = await xeroFetch(`${XERO_API_BASE}/Contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(contactBody),
  });

  if (!upsertResponse.ok) {
    const errorData = await upsertResponse.json().catch(() => ({}));
    console.error("Xero contact upsert failed:", errorData);
    throw new Error(xeroFailureMessage("Contact sync", upsertResponse.status, errorData));
  }

  const upsertData = await upsertResponse.json();
  return upsertData.Contacts[0].ContactID;
}

// Contact resolution with a permanent cache: the search + upsert round-trips are paid
// once per worker ever; every later sync reads Worker.xeroContactId and costs zero
// Xero calls. This is what keeps a full-month bulk sync inside the 60-calls/min limit.
export async function resolveXeroContactId(
  accessToken: string,
  tenantId: string,
  worker: Worker
): Promise<string> {
  if (worker.xeroContactId) return worker.xeroContactId;
  const contactId = await upsertXeroContact(accessToken, tenantId, worker);
  await db.worker.update({ where: { id: worker.id }, data: { xeroContactId: contactId } });
  return contactId;
}

export function buildBillPayload(
  invoice: Invoice,
  contactId: string,
  lines?: InvoiceLine[]
): Record<string, unknown> {
  let lineItems: object[];

  if (lines && lines.length > 0) {
    // Send actual invoice line items to Xero for proper breakdown
    lineItems = lines.map((line) => ({
      Description: line.description,
      Quantity: line.quantity,
      UnitAmount: line.unitRate,
    }));
  } else {
    // Legacy fallback for invoices without line data
    lineItems = [
      {
        Description: `${invoice.description} | ${invoice.period}`,
        Quantity: invoice.quantity,
        UnitAmount: invoice.subtotal / invoice.quantity,
      },
    ];
  }

  if (invoice.vatAmount > 0) {
    lineItems.push({
      Description: `VAT (${invoice.vatRate}%)`,
      Quantity: 1,
      UnitAmount: invoice.vatAmount,
    });
  }

  return {
    Type: "ACCPAY",
    Contact: { ContactID: contactId },
    Date: invoice.invoiceDate.toISOString().split("T")[0],
    DueDate: invoice.dueDate.toISOString().split("T")[0],
    InvoiceNumber: invoice.invoiceNumber,
    Reference: invoice.invoiceNumber,
    CurrencyCode: invoice.currency,
    Status: "DRAFT",
    LineItems: lineItems,
  };
}

export type BatchBillOutcome = {
  invoiceId: string;
  invoiceNumber: string;
  xeroInvoiceId?: string;
  error?: string;
};

// Bills that already exist in Xero for these invoice numbers — makes the batch
// idempotent: if a previous run created bills but the portal-side write failed,
// the next attempt adopts the existing bills instead of duplicating them.
async function findExistingXeroBills(
  accessToken: string,
  tenantId: string,
  invoiceNumbers: string[],
): Promise<Map<string, string>> {
  const response = await xeroFetch(
    `${XERO_API_BASE}/Invoices?InvoiceNumbers=${encodeURIComponent(invoiceNumbers.join(","))}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": tenantId,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return new Map();
  const data = await response.json().catch(() => ({}));
  const bills = (data.Invoices ?? []) as Array<{ InvoiceNumber?: string; InvoiceID?: string; Type?: string; Status?: string }>;
  return new Map(
    bills
      .filter((bill) => bill.Type === "ACCPAY" && bill.Status !== "DELETED" && bill.Status !== "VOIDED" && bill.InvoiceNumber && bill.InvoiceID)
      .map((bill) => [bill.InvoiceNumber as string, bill.InvoiceID as string]),
  );
}

// One POST creates up to ~50 draft bills; SummarizeErrors=false makes Xero return
// per-element results so a single invalid invoice doesn't fail its whole batch.
export async function createXeroDraftBills(
  accessToken: string,
  tenantId: string,
  batch: Array<{ invoice: Invoice & { lines?: InvoiceLine[] }; contactId: string }>
): Promise<BatchBillOutcome[]> {
  const existing = await findExistingXeroBills(
    accessToken,
    tenantId,
    batch.map(({ invoice }) => invoice.invoiceNumber),
  );
  const adopted: BatchBillOutcome[] = [];
  const toCreate: typeof batch = [];
  for (const item of batch) {
    const existingId = existing.get(item.invoice.invoiceNumber);
    if (existingId) {
      adopted.push({ invoiceId: item.invoice.id, invoiceNumber: item.invoice.invoiceNumber, xeroInvoiceId: existingId });
    } else {
      toCreate.push(item);
    }
  }
  if (toCreate.length === 0) return adopted;

  const response = await xeroFetch(`${XERO_API_BASE}/Invoices?SummarizeErrors=false`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Invoices: toCreate.map(({ invoice, contactId }) => buildBillPayload(invoice, contactId, invoice.lines)),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Xero batch bill creation failed:", errorData);
    throw new Error(xeroFailureMessage("Draft bill creation", response.status, errorData));
  }

  // Response Invoices[] mirrors the request order
  const data = await response.json();
  const created = toCreate.map(({ invoice }, index) => {
    const element = data.Invoices?.[index];
    if (!element || element.HasErrors) {
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        error: element?.ValidationErrors?.find((v: { Message?: string }) => v.Message)?.Message ?? "Xero rejected this invoice",
      };
    }
    return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, xeroInvoiceId: element.InvoiceID };
  });
  return [...adopted, ...created];
}

export async function createXeroDraftBill(
  accessToken: string,
  tenantId: string,
  invoice: Invoice,
  contactId: string,
  lines?: InvoiceLine[]
): Promise<string> {
  const billBody = { Invoices: [buildBillPayload(invoice, contactId, lines)] };

  const response = await xeroFetch(`${XERO_API_BASE}/Invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(billBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Xero draft bill creation failed:", errorData);
    throw new Error(xeroFailureMessage("Draft bill creation", response.status, errorData));
  }

  const data = await response.json();
  return data.Invoices[0].InvoiceID;
}

export async function syncInvoiceToXero(
  invoice: Invoice & { lines?: InvoiceLine[] },
  worker: Worker
): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    const tenantId = await getTenantId();
    const contactId = await resolveXeroContactId(accessToken, tenantId, worker);
    const xeroInvoiceId = await createXeroDraftBill(
      accessToken,
      tenantId,
      invoice,
      contactId,
      invoice.lines
    );

    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        xeroSynced: true,
        xeroInvoiceId: xeroInvoiceId,
        xeroSyncedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("syncInvoiceToXero error:", error);
    throw error;
  }
}
