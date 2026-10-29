import { AppError, isCode } from "@/lib/api/errors";
import { formatVnd } from "@/lib/format/money";

export type StockIssue = {
  productId: number;
  name: string;
  requested: number;
  available: number;
};

export type SaleErrorView =
  | { kind: "stock"; issues: StockIssue[] }
  | { kind: "message"; message: string };

/**
 * Reads one finite number out of an error's `details`.
 *
 * Every field of DiscountLimitDetailsDto and PaymentTotalsDetailsDto is optional,
 * and most throw sites in the backend's sale-calculator send no `details` at all —
 * so a field read must never be assumed present. Dereferencing a missing one threw
 * inside the mutation's onError, which React Query swallows: the cashier was left
 * with no message whatsoever. A missing field returns null and the caller falls
 * back to the server's own message, which is already a clean Vietnamese sentence.
 */
function readAmount(details: unknown, key: string): number | null {
  if (typeof details !== "object" || details === null) return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Turns a failed POST /sales into something the POS can actually show the cashier. */
export function describeSaleError(error: unknown): SaleErrorView {
  if (isCode(error, "INSUFFICIENT_STOCK")) {
    return { kind: "stock", issues: (error.details ?? []) as StockIssue[] };
  }

  if (isCode(error, "INVALID_DISCOUNT")) {
    const max = readAmount(error.details, "maxDiscountAmount");
    return {
      kind: "message",
      message:
        max === null
          ? error.message
          : `Giảm giá vượt hạn mức. Tối đa ${formatVnd(max)}.`,
    };
  }

  if (isCode(error, "INVALID_PAYMENT")) {
    const total = readAmount(error.details, "total");
    const paid = readAmount(error.details, "paid");
    return {
      kind: "message",
      message:
        total === null || paid === null
          ? error.message
          : `Thanh toán ${formatVnd(paid)} phải bằng đúng số phải trả ${formatVnd(total)}.`,
    };
  }

  return {
    kind: "message",
    message:
      error instanceof AppError ? error.message : "Không tạo được hóa đơn. Vui lòng thử lại.",
  };
}
