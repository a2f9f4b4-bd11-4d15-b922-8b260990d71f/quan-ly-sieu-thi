export const STORE_TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: STORE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: STORE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const queryDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
});

/** "21/10/2026 00:30" in store time. Always use this for server timestamps. */
export function formatStoreDateTime(isoUtc: string): string {
  // en-GB yields "21/10/2026, 00:30" — drop the comma for a compact cell.
  return dateTimeFormatter.format(new Date(isoUtc)).replace(",", "");
}

/** "21/10/2026" in store time. */
export function formatStoreDate(isoUtc: string): string {
  return dateFormatter.format(new Date(isoUtc));
}

/** "YYYY-MM-DD" in store time, for `from`/`to` query parameters. */
export function toStoreDateString(date: Date): string {
  // en-CA renders ISO-style YYYY-MM-DD.
  return queryDateFormatter.format(date);
}

/**
 * Inclusive day span between two YYYY-MM-DD strings: a single day is 1.
 * An inverted range returns a negative number, which is how callers detect it.
 */
export function daysBetween(from: string, to: string): number {
  const MS_PER_DAY = 86_400_000;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}
