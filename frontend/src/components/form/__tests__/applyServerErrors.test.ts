import { describe, it, expect, vi } from "vitest";
import { applyServerErrors } from "../applyServerErrors";
import { AppError } from "@/lib/api/errors";

const CUSTOMER_FIELDS = ["fullName", "phone", "email"] as const;

describe("applyServerErrors", () => {
  it("maps VALIDATION_ERROR details onto their fields", () => {
    const setError = vi.fn();
    const error = new AppError("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 400, [
      { field: "sku", messages: ["Mã SKU là bắt buộc"] },
      { field: "items.0.quantity", messages: ["Số lượng phải lớn hơn 0"] },
    ]);

    const formMessage = applyServerErrors(error, setError, ["sku", "items.0.quantity"]);

    expect(setError).toHaveBeenCalledWith("sku", { message: "Mã SKU là bắt buộc" });
    expect(setError).toHaveBeenCalledWith("items.0.quantity", {
      message: "Số lượng phải lớn hơn 0",
    });
    expect(formMessage).toBeNull();
  });

  it("reports a VALIDATION_ERROR field the form does not have as a banner", () => {
    const setError = vi.fn();
    const error = new AppError("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 400, [
      { field: "internalFlag", messages: ["Không hợp lệ"] },
    ]);

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBe("Dữ liệu không hợp lệ");
    expect(setError).not.toHaveBeenCalled();
  });

  it("maps DUPLICATE_VALUE onto the violated field", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "SĐT đã tồn tại.", 409, { fields: ["phone"] });

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBeNull();
    expect(setError).toHaveBeenCalledWith("phone", { message: "SĐT đã tồn tại." });
  });

  it("accepts a DUPLICATE_VALUE whose fields is a bare string", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "SĐT đã tồn tại.", 409, { fields: "phone" });

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBeNull();
    expect(setError).toHaveBeenCalledWith("phone", { message: "SĐT đã tồn tại." });
  });

  // The real backend reports the violated MySQL INDEX name, not a form field:
  //   details: { fields: "customers_phone_key" }
  // Calling setError() with that name silently attached the message to a field
  // that does not exist, and suppressed the banner — the user clicked Lưu on a
  // duplicate phone and saw absolutely nothing.
  it("recovers the field name from a MySQL index name", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "SĐT đã tồn tại.", 409, {
      fields: "customers_phone_key",
    });

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBeNull();
    expect(setError).toHaveBeenCalledWith("phone", { message: "SĐT đã tồn tại." });
  });

  it("recovers a camelCase field from a snake_case index name", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "Tên đăng nhập đã tồn tại.", 409, {
      fields: "users_user_name_key",
    });

    expect(applyServerErrors(error, setError, ["userName", "role"])).toBeNull();
    expect(setError).toHaveBeenCalledWith("userName", { message: "Tên đăng nhập đã tồn tại." });
  });

  it("shows a banner when an index name matches no field on the form", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "Giá trị đã tồn tại trong hệ thống.", 409, {
      fields: "customers_loyalty_card_key",
    });

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBe(
      "Giá trị đã tồn tại trong hệ thống.",
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it("falls back to a form-level message when DUPLICATE_VALUE names no field", () => {
    const setError = vi.fn();
    const error = new AppError("DUPLICATE_VALUE", "Giá trị đã tồn tại.", 409, {});

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBe("Giá trị đã tồn tại.");
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns a form-level message for an error with no field information", () => {
    const setError = vi.fn();
    const error = new AppError("CATEGORY_INACTIVE", "Danh mục đã ngừng sử dụng.", 422);

    expect(applyServerErrors(error, setError, CUSTOMER_FIELDS)).toBe("Danh mục đã ngừng sử dụng.");
    expect(setError).not.toHaveBeenCalled();
  });

  it("returns a generic message for a non-AppError", () => {
    expect(applyServerErrors(new Error("boom"), vi.fn(), CUSTOMER_FIELDS)).toBe(
      "Đã xảy ra lỗi. Vui lòng thử lại.",
    );
  });
});
