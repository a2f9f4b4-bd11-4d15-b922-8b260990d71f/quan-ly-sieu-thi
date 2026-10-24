import type { Role } from "@/lib/api/types";

export type Capability =
  | "sell" | "viewSales"
  | "manageCustomers"
  | "manageProducts" | "manageCategories" | "manageSuppliers"
  | "managePurchases" | "receivePurchases"
  | "viewStock" | "viewLowStock" | "countStock" | "viewMovements"
  | "viewRevenueReports" | "viewInventoryReport"
  | "manageUsers"
  | "viewCostPrice";

const MATRIX: Record<Capability, Role[]> = {
  sell: ["ADMIN", "CASHIER"],
  viewSales: ["ADMIN", "CASHIER"],
  manageCustomers: ["ADMIN", "CASHIER"],
  manageProducts: ["ADMIN", "STOCKKEEPER"],
  manageCategories: ["ADMIN", "STOCKKEEPER"],
  manageSuppliers: ["ADMIN", "STOCKKEEPER"],
  managePurchases: ["ADMIN", "STOCKKEEPER"],
  receivePurchases: ["ADMIN", "STOCKKEEPER"],
  viewStock: ["ADMIN", "CASHIER", "STOCKKEEPER"],
  viewLowStock: ["ADMIN", "STOCKKEEPER"],
  countStock: ["ADMIN", "STOCKKEEPER"],
  viewMovements: ["ADMIN", "STOCKKEEPER"],
  viewRevenueReports: ["ADMIN"],
  viewInventoryReport: ["ADMIN", "STOCKKEEPER"],
  manageUsers: ["ADMIN"],
  viewCostPrice: ["ADMIN", "STOCKKEEPER"],
};

/** UX gating only — the server is the real gate and every screen still handles 403. */
export function can(role: Role, capability: Capability): boolean {
  return MATRIX[capability].includes(role);
}

export function homeRouteFor(role: Role): string {
  if (role === "CASHIER") return "/pos";
  if (role === "STOCKKEEPER") return "/inventory";
  return "/";
}
