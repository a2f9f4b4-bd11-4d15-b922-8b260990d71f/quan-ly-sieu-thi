import { describe, it, expect } from "vitest";
import { formatVnd } from "../money";

describe("formatVnd", () => {
  it("formats a whole amount with thousands separators and the đ suffix", () => {
    expect(formatVnd(36000)).toBe("36.000 đ");
  });

  it("formats zero without special-casing", () => {
    expect(formatVnd(0)).toBe("0 đ");
  });

  it("formats the contract maximum", () => {
    expect(formatVnd(9999999999)).toBe("9.999.999.999 đ");
  });

  it("rounds fractional input to whole dong rather than showing decimals", () => {
    expect(formatVnd(1500.6)).toBe("1.501 đ");
  });

  it("formats negative amounts, used for stock-count differences", () => {
    expect(formatVnd(-2000)).toBe("-2.000 đ");
  });
});
