import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/client/client";
import type { PaymentAccountType } from "@/lib/generated/client/enums";
import { isActiveCurrency } from "@/lib/currencies";
import { optionalString } from "@/lib/utils";
import { acquireWorkerProvisioningLock, provisionWorker } from "@/lib/worker-provisioning";
import { generateClaimToken } from "@/lib/worker-claim-token";
import { NextResponse } from "next/server";

function isDuplicateTimeDoctorEmail(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("timeDoctorEmail") : String(target ?? "").includes("timeDoctorEmail");
}

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
    // Slightly longer than Prisma's 5s default: this transaction is 3-4 sequential round trips
    // (advisory lock, worker create, optional payment account, claim token update), and a cold
    // Neon connection can push that close to the default on the first request of a session.
    const { workerId, claimToken } = await db.$transaction(async (tx) => {
      await acquireWorkerProvisioningLock(tx);
      const { workerId } = await provisionWorker(tx, null, {
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
      // Claim link — only this creation path gets one (openspec/changes/close-worker-registration).
      const { token, expiresAt } = generateClaimToken();
      await tx.worker.update({ where: { id: workerId }, data: { claimToken: token, claimTokenExpiresAt: expiresAt } });
      return { workerId, claimToken: token };
    }, { maxWait: 10_000, timeout: 15_000 });
    return NextResponse.json({ success: true, workerId, claimToken });
  } catch (error) {
    if (isDuplicateTimeDoctorEmail(error)) {
      return NextResponse.json({ error: "A worker with this Time Doctor email already exists" }, { status: 409 });
    }
    // Always logged: the client only ever sees a generic message here, so this is the only way
    // to see what actually went wrong (e.g. a validation error's message dumps the whole write
    // payload, which happens to always contain "timeDoctorEmail" as a field name — that used to
    // get misclassified as a duplicate-email 409 above via a naive string-includes check).
    console.error("manual-add worker failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create worker";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
