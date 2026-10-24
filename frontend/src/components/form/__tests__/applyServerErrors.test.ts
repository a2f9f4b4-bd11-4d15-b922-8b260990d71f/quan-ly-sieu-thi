import { describe, it, expect, vi } from "vitest";
import { applyServerErrors } from "../applyServerErrors";
import { AppError } from "@/lib/api/errors";

describe("applyServerErrors", () => {
  it("maps VALIDATION_ERROR details onto their fields", () => {
    const setError = vi.fn();
    const error = new AppError("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 400, [
      { field: "sku", messages: ["Mã SKU là bắt buộc"] },
      { field: "items.0.quantity", messages: ["Số lượng phải lớn hơn 0"] },
    ]);

    const formMessage = applyServerErrors(error, setError);

    expect(setError).toHaveBeenCalledWith("sku", { message: "Mã SKU là bắt buộc" });
    expect(setError).toHaveBeenCalledWith("items.0.quantity", { message: "Số lượng phải lớn hơn 0" });
    expect(formMessage).toBeNull();
  });

  it("maps DUPLICATE_VALUE onto the violated field", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "Mã SKU đã tồn tại.", 409, { fields: ["sku"] });

    expect(applyServerErrors(error, setError)).toBeNull();
    expect(setError).toHaveBeenCalledWith("sku", { message: "Mã SKU đã tồn tại." });
  });

  it("accepts a DUPLICATE_VALUE whose fields is a bare string", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "SĐT đã tồn tại.", 409, { fields: "phone" });

    expect(applyServerErrors(error, setError)).toBeNull();
    expect(setError).toHaveBeenCalledWith("phone", { message: "SĐT đã tồn tại." });
  });

  it("falls back to a form-level message when DUPLICATE_VALUE names no field", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "Giá trị đã tồn tại.", 409, {});

    expect(applyServerErrors(error, setError)).toBe("Giá trị đã tồn tại.");
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns a form-level message for an error with no field information", () => {
    const setError = vi.fn();
    const error = new AppError("CATEGORY_INACTIVE", "Danh mục đã ngừng sử dụng.", 422);

    expect(applyServerErrors(error, setError)).toBe("Danh mục đã ngừng sử dụng.");
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns a generic message for a non-AppError", () => {
    expect(applyServerErrors(new Error("boom"), vi.fn())).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });
});
