export function parseDateInput(value: string): Date {
  if (!value || typeof value !== "string") {
    throw new Error("Invalid date input");
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Invalid date format");
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
