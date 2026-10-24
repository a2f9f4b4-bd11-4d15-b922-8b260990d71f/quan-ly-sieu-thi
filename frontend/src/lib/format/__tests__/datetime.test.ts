import { describe, it, expect } from "vitest";
import {
  formatStoreDateTime,
  formatStoreDate,
  toStoreDateString,
  daysBetween,
} from "../datetime";

describe("store timezone rendering", () => {
  it("renders a late-UTC timestamp on the following store day", () => {
    // 2026-10-20T17:30Z is 2026-10-21 00:30 in Asia/Ho_Chi_Minh
    expect(formatStoreDateTime("2026-10-20T17:30:00.000Z")).toBe("21/10/2026 00:30");
  });

  it("renders a same-day timestamp unchanged in store date", () => {
    expect(formatStoreDate("2026-10-20T04:50:53.609Z")).toBe("20/10/2026");
  });

  it("renders the last minute before the store-day rollover", () => {
    // 16:59Z = 23:59 local, still 20/10
    expect(formatStoreDateTime("2026-10-20T16:59:00.000Z")).toBe("20/10/2026 23:59");
  });

  it("converts a Date to a store-local YYYY-MM-DD query parameter", () => {
    expect(toStoreDateString(new Date("2026-10-20T17:30:00.000Z"))).toBe("2026-10-21");
  });
});

describe("daysBetween", () => {
  it("counts an inclusive single day as 1", () => {
    expect(daysBetween("2026-10-20", "2026-10-20")).toBe(1);
  });

  it("counts a full non-leap year as 365", () => {
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(365);
  });

  it("returns a negative span when the end precedes the start", () => {
    expect(daysBetween("2026-10-20", "2026-10-18")).toBe(-1);
  });

  it("returns 0 for a one-day inversion — the boundary callers must reject", () => {
    expect(daysBetween("2026-10-20", "2026-10-19")).toBe(0);
  });
});
