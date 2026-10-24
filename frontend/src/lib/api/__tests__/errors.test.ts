import { describe, it, expect } from "vitest";
import { AppError, normalizeError, isCode } from "../errors";

describe("normalizeError", () => {
  it("extracts code, message and details from the server envelope", () => {
    const err = normalizeError(409, {
      error: {
        code: "INSUFFICIENT_STOCK",
        message: "Không đủ tồn kho",
        details: [{ productId: 14, requested: 9, available: 2 }],
      },
    });

    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.message).toBe("Không đủ tồn kho");
    expect(err.status).toBe(409);
    expect(err.details).toEqual([{ productId: 14, requested: 9, available: 2 }]);
  });

  it("falls back to INTERNAL_ERROR with a Vietnamese message for an unrecognisable body", () => {
    const err = normalizeError(500, "<html>502 Bad Gateway</html>");
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
    expect(err.status).toBe(500);
  });

  it("maps a network failure (status 0) to SERVICE_UNAVAILABLE", () => {
    const err = normalizeError(0, null);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.status).toBe(0);
  });
});

describe("isCode", () => {
  it("narrows a matching AppError", () => {
    const err = normalizeError(422, { error: { code: "INVALID_DISCOUNT", message: "Vượt hạn mức" } });
    expect(isCode(err, "INVALID_DISCOUNT")).toBe(true);
  });

  it("rejects a different code and non-errors", () => {
    const err = normalizeError(404, { error: { code: "NOT_FOUND", message: "Không tìm thấy" } });
    expect(isCode(err, "INVALID_DISCOUNT")).toBe(false);
    expect(isCode(new Error("boom"), "NOT_FOUND")).toBe(false);
  });
});
