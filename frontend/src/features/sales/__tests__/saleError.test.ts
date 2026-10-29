import { describe, it, expect } from "vitest";
import { describeSaleError } from "../saleError";
import { AppError } from "@/lib/api/errors";

describe("describeSaleError", () => {
  it("surfaces stock shortages as structured issues", () => {
    const issues = [{ productId: 7, name: "7Up lon 330ml", requested: 51, available: 41 }];
    const error = new AppError("INSUFFICIENT_STOCK", "Không đủ tồn kho.", 422, issues);

    expect(describeSaleError(error)).toEqual({ kind: "stock", issues });
  });

  it("builds the discount limit message when the server sends the limit", () => {
    const error = new AppError("INVALID_DISCOUNT", "Giảm giá tối đa cho phép là 10%.", 422, {
      maxDiscountPercent: 10,
      maxDiscountAmount: 4000,
    });

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Giảm giá vượt hạn mức. Tối đa 4.000 đ.",
    });
  });

  // The backend sends INVALID_DISCOUNT with only {subtotal} when the discount
  // exceeds the subtotal, and with NO details at all for a negative discount.
  // Reading maxDiscountAmount unconditionally rendered "Tối đa NaN đ".
  it("falls back to the server message when the discount limit is absent", () => {
    const error = new AppError("INVALID_DISCOUNT", "Giảm giá phải nhỏ hơn tổng tiền hàng.", 422, {
      subtotal: 20000,
    });

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Giảm giá phải nhỏ hơn tổng tiền hàng.",
    });
  });

  it("falls back to the server message when INVALID_DISCOUNT has no details", () => {
    const error = new AppError("INVALID_DISCOUNT", "Giảm giá không được âm.", 422);

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Giảm giá không được âm.",
    });
  });

  it("builds the payment mismatch message when the server sends both totals", () => {
    const error = new AppError("INVALID_PAYMENT", "Tổng số tiền thanh toán phải bằng.", 422, {
      total: 36000,
      paid: 30000,
    });

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Thanh toán 30.000 đ phải bằng đúng số phải trả 36.000 đ.",
    });
  });

  // Four of the five INVALID_PAYMENT paths in sale-calculator.ts send no details.
  // Dereferencing details.paid threw a TypeError inside the mutation's onError,
  // which React Query swallowed — the cashier saw no message at all.
  it("falls back to the server message when INVALID_PAYMENT has no details", () => {
    const error = new AppError(
      "INVALID_PAYMENT",
      "Tiền khách đưa phải lớn hơn hoặc bằng số tiền thanh toán.",
      422,
    );

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Tiền khách đưa phải lớn hơn hoặc bằng số tiền thanh toán.",
    });
  });

  it("falls back when INVALID_PAYMENT sends only one of the two totals", () => {
    const error = new AppError("INVALID_PAYMENT", "Số tiền thanh toán phải lớn hơn 0.", 422, {
      total: 36000,
    });

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Số tiền thanh toán phải lớn hơn 0.",
    });
  });

  it("passes through any other AppError message", () => {
    const error = new AppError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);

    expect(describeSaleError(error)).toEqual({
      kind: "message",
      message: "Không tìm thấy khách hàng.",
    });
  });

  it("gives a generic message for a non-AppError", () => {
    expect(describeSaleError(new Error("boom"))).toEqual({
      kind: "message",
      message: "Không tạo được hóa đơn. Vui lòng thử lại.",
    });
  });

  it("never returns a message containing NaN", () => {
    const shapes: unknown[] = [undefined, null, {}, { total: "36000" }, { paid: NaN }, []];
    for (const details of shapes) {
      const view = describeSaleError(new AppError("INVALID_PAYMENT", "Lỗi thanh toán.", 422, details));
      expect(view.kind === "message" && view.message).not.toContain("NaN");
    }
  });
});
