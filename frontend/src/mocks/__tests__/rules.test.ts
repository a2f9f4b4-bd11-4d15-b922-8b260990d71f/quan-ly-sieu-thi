import { describe, it, expect } from "vitest";
import {
  allocateDiscount,
  computePoints,
  weightedAverageCost,
  maxDiscountFor,
  nextDocumentNumber,
} from "../rules";

describe("allocateDiscount (BR7)", () => {
  it("splits pro rata when the division is exact", () => {
    expect(allocateDiscount([30000, 10000], 4000)).toEqual([3000, 1000]);
  });

  it("gives the rounding remainder to the last line", () => {
    // 1000 / 3 = 333.33 each; last line absorbs the leftover 334
    expect(allocateDiscount([10000, 10000, 10000], 1000)).toEqual([333, 333, 334]);
  });

  it("allocates nothing when there is no discount", () => {
    expect(allocateDiscount([5000, 5000], 0)).toEqual([0, 0]);
  });

  it("always sums back to the original discount", () => {
    const parts = allocateDiscount([7000, 3100, 19900], 997);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(997);
  });
});

describe("computePoints (BR6)", () => {
  it("awards one point per 10.000 VND, rounded down", () => {
    expect(computePoints(36000)).toBe(3);
  });

  it("awards nothing below the threshold", () => {
    expect(computePoints(9999)).toBe(0);
  });

  it("awards exactly at the boundary", () => {
    expect(computePoints(10000)).toBe(1);
  });
});

describe("weightedAverageCost (BR11)", () => {
  it("takes the purchase price when there was no stock", () => {
    expect(weightedAverageCost(0, 0, 10, 6000)).toBe(6000);
  });

  it("blends old and new cost by quantity", () => {
    // (10 * 6000 + 10 * 8000) / 20 = 7000
    expect(weightedAverageCost(10, 6000, 10, 8000)).toBe(7000);
  });

  it("rounds to two decimals", () => {
    // (3 * 1000 + 1 * 1001) / 4 = 1000.25
    expect(weightedAverageCost(3, 1000, 1, 1001)).toBe(1000.25);
  });
});

describe("maxDiscountFor (BR7)", () => {
  it("caps a cashier at 10 percent of subtotal", () => {
    expect(maxDiscountFor("CASHIER", 40000)).toBe(4000);
  });

  it("allows an admin up to the full subtotal", () => {
    expect(maxDiscountFor("ADMIN", 40000)).toBe(40000);
  });

  it("caps a stockkeeper at zero — they do not sell", () => {
    expect(maxDiscountFor("STOCKKEEPER", 40000)).toBe(0);
  });
});

describe("nextDocumentNumber", () => {
  it("formats an invoice number with a 4-digit sequence in store time", () => {
    expect(nextDocumentNumber("HD", new Date("2026-10-20T04:00:00.000Z"), 1)).toBe("HD202610200001");
  });

  it("uses the store day, not the UTC day, after the evening rollover", () => {
    // 17:30Z = 21/10 00:30 local
    expect(nextDocumentNumber("PN", new Date("2026-10-20T17:30:00.000Z"), 7)).toBe("PN202610210007");
  });

  it("grows beyond four digits rather than truncating", () => {
    expect(nextDocumentNumber("KK", new Date("2026-10-20T04:00:00.000Z"), 12345)).toBe("KK2026102012345");
  });
});
