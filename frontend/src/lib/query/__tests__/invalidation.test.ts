import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { INVALIDATION_MAP, invalidateFor } from "../invalidation";
import { qk } from "../keys";

describe("INVALIDATION_MAP", () => {
  it("invalidates stock, sales and customers after a sale", () => {
    expect(INVALIDATION_MAP.createSale).toEqual([
      qk.inventory.all(), qk.sales.all(), qk.customers.all(), qk.products.all(),
    ]);
  });

  it("invalidates products as well as inventory after receiving a purchase, because cost changed too", () => {
    expect(INVALIDATION_MAP.receivePurchase).toContainEqual(qk.products.all());
    expect(INVALIDATION_MAP.receivePurchase).toContainEqual(qk.inventory.all());
    expect(INVALIDATION_MAP.receivePurchase).toContainEqual(qk.purchases.all());
  });

  it("invalidates stock and the movement ledger after a stock count", () => {
    expect(INVALIDATION_MAP.createStockCount).toContainEqual(qk.inventory.all());
  });
});

describe("invalidateFor", () => {
  it("marks the mapped queries stale", async () => {
    const client = new QueryClient();
    client.setQueryData(qk.inventory.stock({ page: 1 }), { items: [] });

    await invalidateFor(client, "createSale");

    expect(client.getQueryState(qk.inventory.stock({ page: 1 }))?.isInvalidated).toBe(true);
  });
});
