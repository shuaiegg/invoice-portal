import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/client/client";
import type { PaymentAccountType } from "@/lib/generated/client/enums";
import { buildTdInvoiceData, type TdInvoiceWorker } from "@/lib/td-sync";
import { isActiveCurrency } from "@/lib/currencies";
import { parsePaymentType } from "@/lib/payment-types";
import { generateInvoiceNumber, reserveInvoiceNumbers } from "@/lib/invoice-number";
import { acquireWorkerProvisioningLock, provisionWorker, type ProvisionWorkerFields } from "@/lib/worker-provisioning";
import { NextResponse } from "next/server";

type ProvisionRequestBody = {
  name?: unknown;
  hourlyRate?: unknown;
  currency?: unknown;
  paymentType?: unknown;
  accountType?: unknown;
  accountEmail?: unknown;
};

function parseAccountType(value: unknown): PaymentAccountType | null {
  return value === "WISE" || value === "PAYPAL" ? value : null;
}

// Shared validation for the "create" (UNMATCHED → new worker) and "configure" (NEEDS_SETUP /
// MISSING_RATE → existing worker) actions. `fallbackName` lets "configure" keep the worker's
// current name when the admin doesn't type a new one.
function parseProvisionFields(
  body: ProvisionRequestBody,
  fallbackName: string | null,
  configuredBy: string,
): { error: string } | { fields: Omit<ProvisionWorkerFields, "timeDoctorEmail" | "team"> } {
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : fallbackName;
  if (!name) return { error: "Name is required" };

  if (typeof body.hourlyRate !== "number" || !Number.isFinite(body.hourlyRate) || body.hourlyRate < 0) {
    return { error: "A valid hourly rate is required" };
  }

  if (!isActiveCurrency(body.currency)) {
    return { error: "A valid currency is required" };
  }

  const paymentType = parsePaymentType(body.paymentType);
  if (!paymentType) return { error: "A valid payment type is required" };

  const accountType = parseAccountType(body.accountType);
  const accountEmail = accountType && typeof body.accountEmail === "string" && body.accountEmail.trim()
    ? body.accountEmail.trim()
    : null;

  return {
    fields: {
      name,
      hourlyRate: body.hourlyRate,
      hourlyRateSource: "MANUAL",
      currency: body.currency,
      paymentType,
      accountType,
      accountEmail,
      // Drives the "Channel" column on the invoice list (lib/payment-channel.ts's
      // deriveChannel — Worker.paymentMethod wins over the payment-account fallback), same as
      // a CSV-imported worker's TD payment-method column.
      paymentMethod: accountType === "WISE" ? "Wise" : accountType === "PAYPAL" ? "PayPal" : "Manual",
      accountLabel: accountType === "WISE" ? "Wise" : accountType === "PAYPAL" ? "PayPal" : null,
      configuredBy,
    },
  };
}

// Backfills one invoice per (this + swept) unresolved failure, using each failure's stored
// hours snapshot rather than re-querying Time Doctor — see design.md D2. Numbers are reserved
// per-year, batched, outside the transaction (matches the existing precedent in
// app/api/invoices/route.ts: a rolled-back invoice burns its reserved number, which is accepted
// elsewhere in this codebase already).
async function backfillInvoices(
  tx: Prisma.TransactionClient,
  worker: TdInvoiceWorker,
  failures: { id: string; billingMonth: string | null; quantity: number | null }[],
) {
  const byYear = new Map<number, { failureId: string; month: number }[]>();
  for (const f of failures) {
    if (!f.billingMonth || f.quantity === null) continue;
    const [yearStr, monthStr] = f.billingMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ failureId: f.id, month });
  }

  for (const [year, entries] of byYear) {
    const numbers = entries.length === 1
      ? [await generateInvoiceNumber(year)]
      : await reserveInvoiceNumbers(year, entries.length);
    for (let i = 0; i < entries.length; i += 1) {
      const { month } = entries[i];
      const failure = failures.find((f) => f.id === entries[i].failureId)!;
      try {
        await tx.invoice.create({
          data: buildTdInvoiceData({
            worker, year, month, quantity: failure.quantity!, invoiceNumber: numbers[i], tdSyncRunId: null,
          }),
        });
      } catch (error) {
        // An invoice for this worker/month already exists (unique constraint) — nothing to
        // backfill, the failure is still resolved below.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;
  const { id } = await params;
  const body = await request.json();
  const action = body.action as string | undefined;

  const failure = await db.tdMatchFailure.findUnique({ where: { id } });
  if (!failure || failure.resolved) return NextResponse.json({ error: "Failure not found" }, { status: 404 });

  if (action === "dismiss") {
    await db.tdMatchFailure.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } });
    return NextResponse.json({ success: true });
  }

  if (action === "ignore") {
    await db.$transaction([
      db.tdIgnoredEmail.upsert({
        where: { email: failure.tdEmail },
        create: { email: failure.tdEmail, ignoredBy: session.user.id },
        update: {},
      }),
      db.tdMatchFailure.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (action === "link") {
    if (failure.reason !== "UNMATCHED") {
      return NextResponse.json({ error: "Only unmatched failures can be linked to an existing worker" }, { status: 400 });
    }
    const workerId = typeof body.workerId === "string" ? body.workerId : null;
    if (!workerId) return NextResponse.json({ error: "Worker is required" }, { status: 400 });
    await db.$transaction([
      db.worker.update({ where: { id: workerId }, data: { timeDoctorEmail: failure.tdEmail } }),
      db.tdMatchFailure.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (action === "create" || action === "configure") {
    if (action === "create" && failure.reason !== "UNMATCHED") {
      return NextResponse.json({ error: "Only unmatched failures can create a new worker" }, { status: 400 });
    }
    if (action === "configure" && failure.reason === "UNMATCHED") {
      return NextResponse.json({ error: "Unmatched failures have no worker to configure — use \"create\" instead" }, { status: 400 });
    }

    const existingWorker = failure.workerId
      ? await db.worker.findUnique({ where: { id: failure.workerId }, select: { id: true, name: true } })
      : null;
    if (action === "configure" && !existingWorker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const parsed = parseProvisionFields(body, existingWorker?.name ?? null, session.user.id);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await db.$transaction(async (tx) => {
      if (!existingWorker) await acquireWorkerProvisioningLock(tx);
      if (existingWorker) await tx.$queryRaw`SELECT "id" FROM "Worker" WHERE "id" = ${existingWorker.id} FOR UPDATE`;

      const { workerId } = await provisionWorker(tx, existingWorker?.id ?? null, {
        ...parsed.fields,
        timeDoctorEmail: failure.tdEmail,
      });

      // Sweep every other unresolved failure for this same person — across all billing
      // months, not just the one clicked — so a backlog gets fully cleared in one action
      // instead of requiring the admin to repeat the same data entry per month.
      const siblingFailures = await tx.tdMatchFailure.findMany({
        where: {
          resolved: false,
          id: { not: failure.id },
          OR: [
            { workerId },
            { workerId: null, tdEmail: { equals: failure.tdEmail, mode: "insensitive" } },
          ],
        },
        select: { id: true, billingMonth: true, quantity: true },
      });

      const allFailures = [
        { id: failure.id, billingMonth: failure.billingMonth, quantity: failure.quantity },
        ...siblingFailures,
      ];

      const worker = await tx.worker.findUniqueOrThrow({
        where: { id: workerId },
        select: { id: true, name: true, hourlyRate: true, currency: true, vatRate: true, paymentType: true },
      });
      await backfillInvoices(tx, worker as TdInvoiceWorker, allFailures);

      await tx.tdMatchFailure.updateMany({
        where: { id: { in: allFailures.map((f) => f.id) } },
        data: { resolved: true, resolvedAt: new Date() },
      });

      return { workerId, resolvedCount: allFailures.length };
    });

    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
