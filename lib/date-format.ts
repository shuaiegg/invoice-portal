export function formatParisDateTime(value: string | Date, locale = "fr-FR"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
