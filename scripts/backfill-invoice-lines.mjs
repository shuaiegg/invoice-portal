import { randomUUID } from "node:crypto";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });

try {
  const { rows: invoices } = await pool.query(`
    SELECT
      i."id",
      i."description",
      i."quantity",
      i."rate",
      i."totalAmount",
      i."createdAt",
      i."updatedAt"
    FROM "Invoice" i
    WHERE NOT EXISTS (
      SELECT 1
      FROM "InvoiceLine" l
      WHERE l."invoiceId" = i."id"
    )
    ORDER BY i."createdAt" ASC
  `);

  if (invoices.length === 0) {
    console.log("No invoices need line-item backfill.");
    process.exit(0);
  }

  await pool.query("BEGIN");

  for (const invoice of invoices) {
    const quantity = Number(invoice.quantity) || 1;
    const unitRate = Number(invoice.rate) || Number(invoice.totalAmount) || 0;
    const amount = quantity * unitRate;

    await pool.query(
      `
        INSERT INTO "InvoiceLine"
          ("id", "invoiceId", "description", "quantity", "unitRate", "amount", "order", "createdAt", "updatedAt")
        VALUES
          ($1, $2, $3, $4, $5, $6, 0, $7, $8)
      `,
      [
        randomUUID(),
        invoice.id,
        invoice.description || "Invoice services",
        quantity,
        unitRate,
        amount,
        invoice.createdAt,
        invoice.updatedAt,
      ],
    );
  }

  await pool.query("COMMIT");
  console.log(`Backfilled ${invoices.length} invoice line item(s).`);
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error("Backfill failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
