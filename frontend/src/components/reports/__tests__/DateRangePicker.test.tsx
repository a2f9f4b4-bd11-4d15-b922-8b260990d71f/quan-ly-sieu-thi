import { describe, it, expect } from "vitest";
import { validateRange } from "../DateRangePicker";

describe("validateRange", () => {
  it("accepts a normal range", () => {
    expect(validateRange("2026-10-01", "2026-10-20")).toBeNull();
  });

  it("accepts a single day, since `to` is inclusive", () => {
    expect(validateRange("2026-10-20", "2026-10-20")).toBeNull();
  });

  it("accepts exactly 366 days", () => {
    expect(validateRange("2026-01-01", "2027-01-01")).toBeNull();
  });

  it("rejects a range where the end precedes the start", () => {
    expect(validateRange("2026-10-20", "2026-10-18")).toBe("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
  });

  it("rejects a ONE-DAY inversion, where the inclusive span is 0", () => {
    expect(validateRange("2026-10-20", "2026-10-19")).toBe("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
  });

  it("rejects 367 days, one past the cap", () => {
    expect(validateRange("2026-01-01", "2027-01-02")).toBe("Khoảng thời gian tối đa là 366 ngày.");
  });

  it("rejects a range longer than 366 days", () => {
    expect(validateRange("2025-01-01", "2026-10-20")).toBe("Khoảng thời gian tối đa là 366 ngày.");
  });

  it("requires both ends", () => {
    expect(validateRange("", "2026-10-20")).toBe("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
    expect(validateRange("2026-10-01", "")).toBe("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
  });
});
