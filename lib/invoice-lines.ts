export type InvoiceLineInput = {
  description?: unknown;
  quantity?: unknown;
  unitRate?: unknown;
};

export type NormalizedInvoiceLine = {
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
  order: number;
};

type InvoiceAmounts = {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
};

export function normalizeInvoiceLines(input: unknown): {
  lines?: NormalizedInvoiceLine[];
  error?: string;
} {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "Invoice must have at least one line item" };
  }

  const lines: NormalizedInvoiceLine[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index] as InvoiceLineInput;
    const description = typeof raw.description === "string" ? raw.description.trim() : "";
    const quantity = Number(raw.quantity);
    const unitRate = Number(raw.unitRate);

    if (!description) {
      return { error: `Line ${index + 1}: description is required` };
    }

    if (description.length > 500) {
      return { error: `Line ${index + 1}: description must be 500 characters or fewer` };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Line ${index + 1}: quantity must be greater than 0` };
    }

    if (!Number.isFinite(unitRate) || unitRate === 0) {
      return { error: `Line ${index + 1}: unit rate must be non-zero` };
    }

    lines.push({
      description,
      quantity,
      unitRate,
      amount: quantity * unitRate,
      order: index,
    });
  }

  return { lines };
}

export function calculateInvoiceAmounts(
  lineSubtotal: number,
  vatRate: number,
  vatInclusive: boolean,
): InvoiceAmounts {
  if (vatRate > 0 && vatInclusive) {
    const totalAmount = lineSubtotal;
    const subtotal = totalAmount / (1 + vatRate / 100);
    return {
      subtotal,
      vatAmount: totalAmount - subtotal,
      totalAmount,
    };
  }

  const subtotal = lineSubtotal;
  const vatAmount = subtotal * (vatRate / 100);
  return {
    subtotal,
    vatAmount,
    totalAmount: subtotal + vatAmount,
  };
}

export function getLegacyInvoiceFields(lines: NormalizedInvoiceLine[]): {
  description: string;
  quantity: number;
  rate: number;
} {
  if (lines.length === 1) {
    return {
      description: lines[0].description,
      quantity: lines[0].quantity,
      rate: lines[0].unitRate,
    };
  }
  // Multi-line: quantity=1, rate=total so quantity×rate always equals totalAmount
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  return {
    description: lines.map((l) => l.description).join("; "),
    quantity: 1,
    rate: totalAmount,
  };
}
