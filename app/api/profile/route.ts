import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePaymentType } from "@/lib/payment-types";
import { optionalString } from "@/lib/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Find or create worker profile
  let worker = await db.worker.findUnique({
    where: { userId },
  });

  if (!worker) {
    // We create a skeleton worker record if it doesn't exist yet
    // The name is required in the DB, so we use the user's name or a default
    worker = await db.worker.create({
      data: {
        userId,
        name: session.user.name || "Worker",
      },
    });
  }

  return NextResponse.json(worker);
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const data = await req.json();
  const paymentType = parsePaymentType(data.paymentType);

  // Validate required fields (name is required by schema)
  if (!data.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (data.paymentType && !paymentType) {
    return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
  }

  const profileData = {
    name: data.name,
    team: optionalString(data.team),
    address: optionalString(data.address),
    city: optionalString(data.city),
    country: optionalString(data.country),
    vatNumber: optionalString(data.vatNumber),
    vatRate: parseFloat(data.vatRate) || 0,
    paymentNotes: optionalString(data.paymentNotes),
    ...(paymentType ? { paymentType } : {}),
    timeDoctorEmail: optionalString(data.timeDoctorEmail),
  };

  const worker = await db.worker.upsert({
    where: { userId },
    update: profileData,
    create: {
      ...profileData,
      userId,
    },
  });

  return NextResponse.json(worker);
}
