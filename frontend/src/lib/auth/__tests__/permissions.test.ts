import { describe, it, expect } from "vitest";
import { can, homeRouteFor } from "../permissions";

describe("can", () => {
  it("lets an admin do everything", () => {
    expect(can("ADMIN", "sell")).toBe(true);
    expect(can("ADMIN", "viewRevenueReports")).toBe(true);
    expect(can("ADMIN", "manageUsers")).toBe(true);
  });

  it("lets a cashier sell but not see revenue reports or suppliers", () => {
    expect(can("CASHIER", "sell")).toBe(true);
    expect(can("CASHIER", "viewRevenueReports")).toBe(false);
    expect(can("CASHIER", "manageSuppliers")).toBe(false);
    expect(can("CASHIER", "manageUsers")).toBe(false);
  });

  it("lets a stockkeeper manage inventory but not sell", () => {
    expect(can("STOCKKEEPER", "receivePurchases")).toBe(true);
    expect(can("STOCKKEEPER", "countStock")).toBe(true);
    expect(can("STOCKKEEPER", "viewInventoryReport")).toBe(true);
    expect(can("STOCKKEEPER", "sell")).toBe(false);
  });

  it("lets every role view stock", () => {
    expect(can("ADMIN", "viewStock")).toBe(true);
    expect(can("CASHIER", "viewStock")).toBe(true);
    expect(can("STOCKKEEPER", "viewStock")).toBe(true);
  });

  it("hides cost price from cashiers only", () => {
    expect(can("ADMIN", "viewCostPrice")).toBe(true);
    expect(can("STOCKKEEPER", "viewCostPrice")).toBe(true);
    expect(can("CASHIER", "viewCostPrice")).toBe(false);
  });
});

describe("homeRouteFor", () => {
  it("routes each role to its working screen", () => {
    expect(homeRouteFor("ADMIN")).toBe("/");
    expect(homeRouteFor("CASHIER")).toBe("/pos");
    expect(homeRouteFor("STOCKKEEPER")).toBe("/inventory");
  });
});
