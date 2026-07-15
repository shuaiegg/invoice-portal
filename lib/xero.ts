import { db } from "./db";
import { Invoice, InvoiceLine, Worker } from "./generated/client/client";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

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
  const searchResponse = await fetch(
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

  const upsertResponse = await fetch(`${XERO_API_BASE}/Contacts`, {
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
    throw new Error("Failed to sync contact to Xero.");
  }

  const upsertData = await upsertResponse.json();
  return upsertData.Contacts[0].ContactID;
}

export async function createXeroDraftBill(
  accessToken: string,
  tenantId: string,
  invoice: Invoice,
  contactId: string,
  lines?: InvoiceLine[]
): Promise<string> {
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

  const billBody = {
    Invoices: [
      {
        Type: "ACCPAY",
        Contact: { ContactID: contactId },
        Date: invoice.invoiceDate.toISOString().split("T")[0],
        DueDate: invoice.dueDate.toISOString().split("T")[0],
        InvoiceNumber: invoice.invoiceNumber,
        Reference: invoice.invoiceNumber,
        CurrencyCode: invoice.currency,
        Status: "DRAFT",
        LineItems: lineItems,
      },
    ],
  };

  const response = await fetch(`${XERO_API_BASE}/Invoices`, {
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
    throw new Error("Failed to create draft bill in Xero.");
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
    const contactId = await upsertXeroContact(accessToken, tenantId, worker);
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
