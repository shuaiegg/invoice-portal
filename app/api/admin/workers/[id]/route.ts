import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { parsePaymentType } from "@/lib/payment-types";
import { NextResponse } from "next/server";

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

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
    cryptoCoin: worker.cryptoCoin,
    cryptoNetwork: worker.cryptoNetwork,
    cryptoWallet: worker.cryptoWallet,
    paypalEmail: worker.paypalEmail,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
    user: worker.user,
    invoices: worker.invoices,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id } = await params;
  const { active, paymentType: rawPaymentType, timeDoctorEmail } = await req.json();
  const paymentType = parsePaymentType(rawPaymentType);

  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid active status" }, { status: 400 });
  }

  if (rawPaymentType !== undefined && !paymentType) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  const worker = await db.worker.findUnique({
    where: { id },
    select: { userId: true, paymentType: true, timeDoctorEmail: true },
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const [updatedWorker] = await db.$transaction([
    db.worker.update({
      where: { id },
      data: {
        ...(paymentType ? { paymentType } : {}),
        ...(timeDoctorEmail !== undefined ? { timeDoctorEmail: optionalString(timeDoctorEmail) } : {}),
      },
    }),
    ...(active !== undefined
      ? [
          db.user.update({
            where: { id: worker.userId },
            data: { active },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    success: true,
    active,
    paymentType: updatedWorker.paymentType,
    timeDoctorEmail: updatedWorker.timeDoctorEmail,
  });
}
