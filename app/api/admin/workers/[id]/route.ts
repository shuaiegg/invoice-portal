import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { parsePaymentType } from "@/lib/payment-types";
import { optionalString } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;

  const worker = await db.worker.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          active: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
      paymentAccounts: {
        orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: worker.id,
    userId: worker.userId,
    name: worker.name,
    team: worker.team,
    address: worker.address,
    city: worker.city,
    country: worker.country,
    vatNumber: worker.vatNumber,
    vatRate: worker.vatRate,
    paymentMethod: worker.paymentMethod,
    paymentAccount: worker.paymentAccount,
    paymentNotes: worker.paymentNotes,
    bankName: worker.bankName,
    swiftCode: worker.swiftCode,
    postCode: worker.postCode,
    secondaryPayment: worker.secondaryPayment,
    paymentType: worker.paymentType,
    timeDoctorEmail: worker.timeDoctorEmail,
    hourlyRate: worker.hourlyRate,
    hourlyRateSource: worker.hourlyRateSource,
    currency: worker.currency,
    cryptoCoin: worker.cryptoCoin,
    cryptoNetwork: worker.cryptoNetwork,
    cryptoWallet: worker.cryptoWallet,
    paypalEmail: worker.paypalEmail,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
    user: worker.user,
    invoices: worker.invoices,
    paymentAccounts: worker.paymentAccounts,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;

  const { id } = await params;
  const { active, paymentType: rawPaymentType, timeDoctorEmail, hourlyRate } = await req.json();
  const paymentType = parsePaymentType(rawPaymentType);

  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid active status" }, { status: 400 });
  }

  if (rawPaymentType !== undefined && !paymentType) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  if (hourlyRate !== undefined && (typeof hourlyRate !== "number" || !Number.isFinite(hourlyRate) || hourlyRate < 0)) {
    return NextResponse.json({ error: "Invalid hourly rate" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Worker" WHERE "id" = ${id} FOR UPDATE`;
    const worker = await tx.worker.findUnique({
      where: { id },
      select: { userId: true, hourlyRate: true },
    });
    if (!worker) return { kind: "not_found" as const };
    if (active !== undefined && !worker.userId) return { kind: "pending" as const };

    const updatedWorker = await tx.worker.update({
      where: { id },
      data: {
        ...(paymentType ? { paymentType } : {}),
        ...(timeDoctorEmail !== undefined ? { timeDoctorEmail: optionalString(timeDoctorEmail) } : {}),
        ...(hourlyRate !== undefined && hourlyRate !== worker.hourlyRate
          ? {
              hourlyRate,
              hourlyRateSource: "MANUAL" as const,
              hourlyRateUpdatedAt: new Date(),
              hourlyRateUpdatedBy: session.user.id,
            }
          : {}),
      },
    });
    if (active !== undefined) {
      await tx.user.update({ where: { id: worker.userId! }, data: { active } });
    }
    return { kind: "updated" as const, worker: updatedWorker };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }
  if (result.kind === "pending") {
    return NextResponse.json({ error: "Pending workers do not have an account status" }, { status: 400 });
  }
  const updatedWorker = result.worker;

  return NextResponse.json({
    success: true,
    active,
    paymentType: updatedWorker.paymentType,
    timeDoctorEmail: updatedWorker.timeDoctorEmail,
    hourlyRate: updatedWorker.hourlyRate,
    hourlyRateSource: updatedWorker.hourlyRateSource,
  });
}
