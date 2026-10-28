import { describe, it, expect } from "vitest";
import { AppError, normalizeError, isCode } from "../errors";

describe("normalizeError", () => {
  it("extracts code, message and details from the flat ErrorEnvelopeDto", () => {
    // The contract's ErrorEnvelopeDto is FLAT — not nested under `error`.
    const err = normalizeError(409, {
      success: false,
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
      message: "Không đủ tồn kho",
      data: null,
      details: [{ productId: 14, requested: 9, available: 2 }],
      requestId: "req-1",
      timestamp: "2026-10-28T13:11:06.111Z",
    });

    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");
    expect(err.message).toBe("Không đủ tồn kho");
    expect(err.status).toBe(409);
    expect(err.details).toEqual([{ productId: 14, requested: 9, available: 2 }]);
  });

  it("ignores a success envelope that happens to carry a code", () => {
    // A 2xx body also has `code` ("OK"); only `success: false` is an error.
    const err = normalizeError(500, { success: true, statusCode: 200, code: "OK", message: "Thành công", data: {} });
    expect(err.code).toBe("INTERNAL_ERROR");
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
    const err = normalizeError(422, { success: false, statusCode: 422, code: "INVALID_DISCOUNT", message: "Vượt hạn mức", data: null });
    expect(isCode(err, "INVALID_DISCOUNT")).toBe(true);
  });

  it("rejects a different code and non-errors", () => {
    const err = normalizeError(404, { success: false, statusCode: 404, code: "NOT_FOUND", message: "Không tìm thấy", data: null });
    expect(isCode(err, "INVALID_DISCOUNT")).toBe(false);
    expect(isCode(new Error("boom"), "NOT_FOUND")).toBe(false);
  });
});
