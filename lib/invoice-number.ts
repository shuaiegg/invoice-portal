import { db } from "./db";

/**
 * Generates a sequential invoice number for a given year.
 * Uses an atomic PostgreSQL query to prevent race conditions.
 * Format: INV-YYYY-NNNN (e.g., INV-2026-0001)
 */
export async function generateInvoiceNumber(year: number): Promise<string> {
  // Use raw SQL for atomic increment with RETURNING
  // Note: Prisma 7 raw queries return an array of results
  const result = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "InvoiceCounter" (year, count)
    VALUES (${year}, 1)
    ON CONFLICT (year)
    DO UPDATE SET count = "InvoiceCounter".count + 1
    RETURNING count
  `;

  if (!result || result.length === 0) {
    throw new Error("Failed to generate invoice number");
  }

  const count = result[0].count;
  const paddedCount = String(count).padStart(4, "0");
  return `INV-${year}-${paddedCount}`;
}

/**
 * Reserves a contiguous block of `count` sequential invoice numbers in a single atomic query,
 * instead of calling generateInvoiceNumber() once per invoice. Used by the TD sync, which can
 * create 100+ invoices in one run — one round trip instead of one-per-invoice keeps a bulk sync
 * fast without weakening the atomic-counter guarantee (the increment-by-N is still one atomic
 * statement, so concurrent callers still get non-overlapping ranges).
 */
export async function reserveInvoiceNumbers(year: number, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const result = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "InvoiceCounter" (year, count)
    VALUES (${year}, ${count})
    ON CONFLICT (year)
    DO UPDATE SET count = "InvoiceCounter".count + ${count}
    RETURNING count
  `;

  if (!result || result.length === 0) {
    throw new Error("Failed to reserve invoice numbers");
  }

  const finalCount = result[0].count;
  const startCount = finalCount - count + 1;
  return Array.from({ length: count }, (_, i) => `INV-${year}-${String(startCount + i).padStart(4, "0")}`);
}
