import { toStoreDateString } from "@/lib/format/datetime";
import type { Role } from "@/lib/api/types";

/**
 * BR7 — an invoice discount is split across lines in proportion to each line's
 * subtotal, rounded to whole dong, with the final line absorbing the remainder
 * so the parts always sum back to the discount.
 */
export function allocateDiscount(lineSubtotals: number[], discount: number): number[] {
  if (discount <= 0 || lineSubtotals.length === 0) {
    return lineSubtotals.map(() => 0);
  }

  const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
  if (subtotal <= 0) return lineSubtotals.map(() => 0);

  const parts = lineSubtotals.map((line) => Math.round((discount * line) / subtotal));
  const allocated = parts.slice(0, -1).reduce((a, b) => a + b, 0);
  parts[parts.length - 1] = discount - allocated;
  return parts;
}

/** BR6 — one point per 10.000 VND of the post-discount total, rounded down. */
export function computePoints(total: number): number {
  return Math.floor(total / 10_000);
}

/** BR11 — weighted average cost on goods receipt, to two decimals. */
export function weightedAverageCost(
  oldQty: number,
  oldCost: number,
  inQty: number,
  inCost: number,
): number {
  if (oldQty <= 0) return inCost;
  const blended = (oldQty * oldCost + inQty * inCost) / (oldQty + inQty);
  return Math.round(blended * 100) / 100;
}

const DISCOUNT_CEILING: Record<Role, number> = {
  ADMIN: 1,
  CASHIER: 0.1,
  STOCKKEEPER: 0,
};

/** BR7 — the maximum discount this role may apply to a given subtotal. */
export function maxDiscountFor(role: Role, subtotal: number): number {
  return Math.floor(subtotal * DISCOUNT_CEILING[role]);
}

/** `HD`/`PN`/`KK` + store-local yyyyMMdd + a sequence padded to at least 4 digits. */
export function nextDocumentNumber(
  prefix: "HD" | "PN" | "KK",
  date: Date,
  sequence: number,
): string {
  const day = toStoreDateString(date).replaceAll("-", "");
  return `${prefix}${day}${String(sequence).padStart(4, "0")}`;
}
