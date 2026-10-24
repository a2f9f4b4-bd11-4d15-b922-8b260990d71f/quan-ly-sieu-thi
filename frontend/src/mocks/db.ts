import type {
  ProductResponse, CategoryResponse, SupplierResponse,
  CustomerResponse, UserResponse,
} from "@/lib/api/types";
import { seed } from "./seed";

export type MockSale = {
  id: number; invoiceNo: string; customerId: number | null; cashierId: number;
  status: "PAID"; subtotal: number; discountAmount: number; total: number;
  pointsEarned: number; soldAt: string;
  items: Array<{
    id: number; productId: number; skuSnapshot: string; nameSnapshot: string;
    quantity: number; unitPrice: number; unitCostSnapshot: number;
    discountAmount: number; lineTotal: number;
  }>;
  payments: Array<{
    id: number; saleId: number; method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
    amount: number; tenderedAmount: number; changeAmount: number;
    paidAt: string; reference?: string;
  }>;
};

export type MockPurchase = {
  id: number; purchaseNo: string; supplierId: number; createdBy: number;
  status: "DRAFT" | "RECEIVED" | "CANCELLED"; subtotal: number; total: number;
  note?: string; receivedAt: string | null; receivedBy: number | null; createdAt: string;
  items: Array<{ id: number; productId: number; quantity: number; unitCost: number; lineTotal: number }>;
};

export type MockMovement = {
  id: number; productId: number; type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "REVERSAL";
  quantity: number; referenceType: "PURCHASE" | "SALE" | "STOCK_COUNT";
  referenceId: number; createdBy: number; createdAt: string;
};

export type MockStockCount = {
  id: number; countNo: string; productId: number; systemQty: number;
  countedQty: number; difference: number; reason: string;
  createdBy: number; createdAt: string;
};

export type MockUser = UserResponse & { password: string };

export type MockDb = {
  users: MockUser[];
  categories: CategoryResponse[];
  products: ProductResponse[];
  suppliers: SupplierResponse[];
  customers: CustomerResponse[];
  sales: MockSale[];
  purchases: MockPurchase[];
  movements: MockMovement[];
  stockCounts: MockStockCount[];
  sequences: Record<string, number>;
  tokens: Record<string, { userId: number; expiresAt: number }>;
};

const STORAGE_KEY = "mini-store.mockdb";

function load(): MockDb {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw) as MockDb; } catch { /* fall through to seed */ }
    }
  }
  return seed();
}

export let db: MockDb = load();

/** Persist after every mutation so a page refresh does not erase the demo. */
export function persist(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

/**
 * Re-reads the store from localStorage.
 *
 * Each browser tab runs its own JS realm and therefore its own in-memory `db`.
 * Without this, a sale in one tab is invisible to a stock count open in another,
 * and genuine cross-terminal conflicts (UC-04 E2) could never occur. Every
 * mutation persists, so localStorage is the shared source of truth.
 */
export function syncFromStorage(): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    db = JSON.parse(raw) as MockDb;
  } catch {
    /* keep the in-memory copy if the stored value is unreadable */
  }
}

export function resetDb(): void {
  db = seed();
  persist();
}

export function nextId(rows: Array<{ id: number }>): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

export function nextSequence(key: string): number {
  db.sequences[key] = (db.sequences[key] ?? 0) + 1;
  return db.sequences[key];
}

export function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: { page, pageSize, total: items.length },
  };
}

export function matchesSearch(haystack: Array<string | null | undefined>, search?: string | null) {
  if (!search || !search.trim()) return true;
  const needle = search.trim().toLowerCase();
  return haystack.some((v) => (v ?? "").toLowerCase().includes(needle));
}
