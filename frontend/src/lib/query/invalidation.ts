import type { QueryClient } from "@tanstack/react-query";
import { qk } from "./keys";

export type MutationName =
  | "createSale"
  | "createPurchase" | "updatePurchase" | "receivePurchase" | "cancelPurchase"
  | "createStockCount"
  | "mutateProduct" | "mutateCategory" | "mutateSupplier" | "mutateCustomer" | "mutateUser";

/**
 * What becomes stale after each mutation.
 * Receiving a purchase changes both quantity and weighted-average cost,
 * so products must be invalidated alongside inventory.
 */
export const INVALIDATION_MAP: Record<MutationName, readonly (readonly unknown[])[]> = {
  createSale: [qk.inventory.all(), qk.sales.all(), qk.customers.all(), qk.products.all()],
  createPurchase: [qk.purchases.all()],
  updatePurchase: [qk.purchases.all()],
  receivePurchase: [qk.purchases.all(), qk.inventory.all(), qk.products.all()],
  cancelPurchase: [qk.purchases.all()],
  createStockCount: [qk.inventory.all(), qk.products.all()],
  mutateProduct: [qk.products.all(), qk.inventory.all()],
  mutateCategory: [qk.categories.all(), qk.products.all()],
  mutateSupplier: [qk.suppliers.all()],
  mutateCustomer: [qk.customers.all()],
  mutateUser: [qk.users.all()],
};

export async function invalidateFor(client: QueryClient, mutation: MutationName): Promise<void> {
  await Promise.all(
    INVALIDATION_MAP[mutation].map((queryKey) =>
      client.invalidateQueries({ queryKey: queryKey as unknown[] }),
    ),
  );
}
