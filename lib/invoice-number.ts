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
