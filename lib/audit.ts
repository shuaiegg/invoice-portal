import { db } from "./db";

type InvoiceStatusChangedDetails = {
  invoiceNumber: string;
  workerName: string;
  from: string;
  to: string;
  bulk?: boolean;
};

type UserRoleChangedDetails = {
  userEmail: string;
  userName: string;
  from: string;
  to: string;
};

export async function logInvoiceStatusChanged(
  actorId: string,
  actorName: string,
  invoiceId: string,
  details: InvoiceStatusChangedDetails
) {
  await db.auditLog.create({
    data: {
      action: "INVOICE_STATUS_CHANGED",
      entityType: "INVOICE",
      entityId: invoiceId,
      actorId,
      actorName,
      details,
    },
  });
}

export async function logInvoiceStatusChangedBulk(
  actorId: string,
  actorName: string,
  entries: Array<{ invoiceId: string; details: InvoiceStatusChangedDetails }>
) {
  await db.auditLog.createMany({
    data: entries.map(({ invoiceId, details }) => ({
      action: "INVOICE_STATUS_CHANGED",
      entityType: "INVOICE",
      entityId: invoiceId,
      actorId,
      actorName,
      details,
    })),
  });
}

export async function logUserRoleChanged(
  actorId: string,
  actorName: string,
  targetUserId: string,
  details: UserRoleChangedDetails
) {
  await db.auditLog.create({
    data: {
      action: "USER_ROLE_CHANGED",
      entityType: "USER",
      entityId: targetUserId,
      actorId,
      actorName,
      details,
    },
  });
}
