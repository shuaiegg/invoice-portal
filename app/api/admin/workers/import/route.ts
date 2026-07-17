import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/client/client";
import { tdWorkerInvite } from "@/lib/slack";
import { buildTdWorkerMatcher } from "@/lib/td-worker-matching";
import { fetchTeamsByEmail } from "@/lib/timedoctor";
import { acquireWorkerProvisioningLock, provisionWorker } from "@/lib/worker-provisioning";
import {
  decideRateImport,
  isTransientConnectionError,
  parsePayrollSummaryCsv,
  paymentAccountTypeForTdMethod,
  TD_IMPORT_PAYMENT_TYPE,
  withConnectionRetry,
  WORKER_IMPORT_TRANSACTION_OPTIONS,
} from "@/lib/worker-import";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;
  const session = guard.session!;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Payroll summary CSV is required" }, { status: 400 });
    }

    const rows = parsePayrollSummaryCsv(await file.text());

    // Team isn't in the CSV at all — TD only exposes it via its tags API. Fetched once, outside
    // the transaction (it's a live external call, shouldn't hold the advisory lock/DB connection
    // open) and best-effort: if TD is unreachable or not configured, the import still proceeds
    // with rate/currency/payment data from the CSV, just without team assignment this run.
    let teamsByEmail = new Map<string, string>();
    try {
      teamsByEmail = await fetchTeamsByEmail();
    } catch (error) {
      console.error("Time Doctor team lookup failed, continuing import without team data:", error);
    }

    // Declared fresh inside the retried callback (not hoisted above withConnectionRetry) — a
    // failed-then-retried attempt must not carry over entries from the rolled-back try, or a
    // successful retry would double-fire Slack invites for the same newly-created workers.
    const { createdWorkers, ...counts } = await withConnectionRetry(() => db.$transaction(async (tx) => {
      const createdWorkers: Array<{ name: string; timeDoctorEmail: string }> = [];
      // Non-blocking advisory lock, held for the transaction's lifetime and auto-released on
      // commit/rollback. Prevents two overlapping imports (e.g. an impatient double-click) from
      // racing on the same rows — and, since Worker.timeDoctorEmail is unique, from racing the
      // other worker-creation entry points (TD sync failure resolution, manual admin add) that
      // share this same lock via lib/worker-provisioning.ts.
      try {
        await acquireWorkerProvisioningLock(tx);
      } catch {
        throw new Error("Another Time Doctor import is already running. Please wait for it to finish before starting a new one.");
      }

      const batch = await tx.workerImportBatch.create({
        data: { importedBy: session.user.id, filename: file.name },
      });
      let createdCount = 0;
      let updatedCount = 0;
      let conflictCount = 0;

      // Batch the "does this worker already exist" lookup into one round trip instead of one
      // findFirst per CSV row — with ~260+ rows, the per-row version held the transaction open
      // long enough to trip Neon's connection handling ("Connection terminated unexpectedly").
      // The company is a few hundred workers, so fetching all of them is cheap and simple —
      // safer than relying on Prisma's `in` + case-insensitive matching across DB versions.
      //
      // Match by timeDoctorEmail first, falling back to the worker's own login email — the same
      // matcher the monthly TD sync uses (lib/td-worker-matching.ts). A worker who self-registered
      // (never had timeDoctorEmail set) must still be found here, or every import "creates" a
      // fresh duplicate pending worker for them instead of updating the real one.
      const allWorkers = await tx.worker.findMany({
        select: {
          id: true, timeDoctorEmail: true, hourlyRate: true, hourlyRateSource: true,
          user: { select: { email: true, active: true } },
        },
      });
      const matcher = buildTdWorkerMatcher(allWorkers);
      const matchedIds = rows
        .map((row) => {
          const match = matcher.match(row.email);
          return match.kind === "matched" ? match.worker.id : undefined;
        })
        .filter((id): id is string => Boolean(id));
      if (matchedIds.length) {
        // Lock every matched row up front in one query, so a concurrent admin edit
        // (e.g. PUT /api/admin/workers/[id]) can't interleave with this import's writes.
        // Prisma.join binds each id as its own placeholder ($1, $2, ...) rather than relying on
        // native array-parameter binding, which isn't uniformly supported across drivers.
        await tx.$queryRaw`SELECT "id" FROM "Worker" WHERE "id" IN (${Prisma.join(matchedIds)}) FOR UPDATE`;
      }

      for (const row of rows) {
        const match = matcher.match(row.email);
        if (match.kind === "inactive") continue; // deactivated Portal account — don't touch, don't duplicate
        const worker = match.kind === "matched" ? match.worker : null;
        const accountType = paymentAccountTypeForTdMethod(row.paymentMethod);
        const team = teamsByEmail.get(row.email);

        const accountEmail = accountType === "PAYPAL" ? row.email : null;

        if (!worker) {
          await provisionWorker(tx, null, {
            name: row.name,
            timeDoctorEmail: row.email,
            team,
            hourlyRate: row.hourlyRate,
            hourlyRateSource: "TD_IMPORT",
            currency: row.currency,
            paymentType: TD_IMPORT_PAYMENT_TYPE,
            paymentMethod: row.paymentMethod,
            accountType,
            accountEmail,
            configuredBy: null,
          });
          createdWorkers.push({ name: row.name, timeDoctorEmail: row.email });
          createdCount += 1;
          continue;
        }

        const decision = decideRateImport(worker.hourlyRateSource, worker.hourlyRate, row.hourlyRate);
        if (decision === "conflict") {
          await tx.workerRateConflict.create({
            data: {
              workerId: worker.id,
              portalRate: worker.hourlyRate!,
              importedRate: row.hourlyRate,
              importBatchId: batch.id,
            },
          });
          conflictCount += 1;

          // Rate is deliberately left untouched on conflict, but payment-account details (Wise/
          // PayPal identifiers) aren't part of the rate conflict — those still get refreshed.
          if (accountType) {
            const account = await tx.paymentAccount.findFirst({ where: { workerId: worker.id, type: accountType } });
            if (account) {
              await tx.paymentAccount.update({ where: { id: account.id }, data: { email: accountEmail ?? account.email } });
            } else {
              await tx.paymentAccount.create({
                data: { workerId: worker.id, type: accountType, email: accountEmail, label: `Time Doctor ${row.paymentMethod}` },
              });
            }
          }
        } else {
          // Backfill timeDoctorEmail if this worker was only found via the user.email fallback —
          // self-heals the primary match key so future imports/syncs don't need the fallback at all.
          await provisionWorker(tx, worker.id, {
            name: row.name,
            timeDoctorEmail: row.email,
            // Best-effort: only overwrite team when this run actually resolved one for this
            // email, so a failed/partial TD tags lookup never wipes out a previously-set team.
            team,
            hourlyRate: row.hourlyRate,
            hourlyRateSource: "TD_IMPORT",
            currency: row.currency,
            paymentType: TD_IMPORT_PAYMENT_TYPE,
            paymentMethod: row.paymentMethod,
            accountType,
            accountEmail,
            configuredBy: null,
          });
          updatedCount += 1;
        }
      }

      await tx.workerImportBatch.update({
        where: { id: batch.id },
        data: { createdCount, updatedCount, conflictCount },
      });
      return { batchId: batch.id, createdCount, updatedCount, conflictCount, createdWorkers };
    }, WORKER_IMPORT_TRANSACTION_OPTIONS));

    createdWorkers.forEach(tdWorkerInvite);
    return NextResponse.json(counts);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "CSV import failed";
    const isConnectionDrop = isTransientConnectionError(error);
    return NextResponse.json(
      {
        error: isConnectionDrop
          ? "Lost connection to the database mid-import. Nothing was saved (the whole import is one transaction) — please try again."
          : rawMessage,
      },
      { status: isConnectionDrop ? 503 : 400 },
    );
  }
}
