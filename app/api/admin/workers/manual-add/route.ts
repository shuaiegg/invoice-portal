import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import type { PaymentAccountType } from "@/lib/generated/client/enums";
import { isActiveCurrency } from "@/lib/currencies";
import { optionalString } from "@/lib/utils";
import { acquireWorkerProvisioningLock, provisionWorker } from "@/lib/worker-provisioning";
import { NextResponse } from "next/server";

function parseAccountType(value: unknown): PaymentAccountType | null {
  return value === "WISE" || value === "PAYPAL" ? value : null;
}

// Admin-only worker creation for pre-provisioning a new hire mid-month (with their Time Doctor
// email) so the *next* TD sync matches and invoices them automatically — a lighter alternative
// to redoing a full CSV import for one or two people. Every worker created here is assumed to be
// a Time Doctor employee: `paymentType` is always TD_PLUS (hardcoded, not client-supplied) and
// `timeDoctorEmail` is required — there's no Manual option in this flow (per user direction
// 2026-07-17, offering it here just invites finance confusion; a genuinely non-TD Manual worker
// is configured from the worker's own detail page instead). No Slack invite is fired here
// (deliberate — see openspec/changes/td-sync-worker-onboarding proposal.md); admin notifies the
// person manually about registering.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const timeDoctorEmail = optionalString(body.timeDoctorEmail);
  if (!timeDoctorEmail) return NextResponse.json({ error: "Time Doctor email is required" }, { status: 400 });

  if (typeof body.hourlyRate !== "number" || !Number.isFinite(body.hourlyRate) || body.hourlyRate < 0) {
    return NextResponse.json({ error: "A valid hourly rate is required" }, { status: 400 });
  }

  if (!isActiveCurrency(body.currency)) {
    return NextResponse.json({ error: "A valid currency is required" }, { status: 400 });
  }

  const accountType = parseAccountType(body.accountType);
  const accountEmail = accountType && typeof body.accountEmail === "string" && body.accountEmail.trim()
    ? body.accountEmail.trim()
    : null;
  try {
    const { workerId } = await db.$transaction(async (tx) => {
      await acquireWorkerProvisioningLock(tx);
      return provisionWorker(tx, null, {
        name,
        timeDoctorEmail,
        hourlyRate: body.hourlyRate,
        hourlyRateSource: "MANUAL",
        currency: body.currency,
        paymentType: "TD_PLUS",
        accountType,
        accountEmail,
        // Drives the "Channel" column on the invoice list (lib/payment-channel.ts's
        // deriveChannel — Worker.paymentMethod wins over the payment-account fallback), same as
        // a CSV-imported worker's TD payment-method column.
        paymentMethod: accountType === "WISE" ? "Wise" : accountType === "PAYPAL" ? "PayPal" : "Manual",
        accountLabel: accountType === "WISE" ? "Wise" : accountType === "PAYPAL" ? "PayPal" : null,
        configuredBy: session.user.id,
      });
    });
    return NextResponse.json({ success: true, workerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create worker";
    // Unique constraint on Worker.timeDoctorEmail — someone already has this TD email.
    const isDuplicate = message.includes("Unique constraint") || message.includes("timeDoctorEmail");
    return NextResponse.json(
      { error: isDuplicate ? "A worker with this Time Doctor email already exists" : message },
      { status: isDuplicate ? 409 : 400 },
    );
  }
}
