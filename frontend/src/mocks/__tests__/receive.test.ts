import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "../handlers";
import { db, resetDb } from "../db";
import { api, login, unwrap, unwrapList } from "@/lib/api/client";
import { clearSession } from "@/lib/api/session";
import type { MovementResponse, PurchaseDetailResponse } from "@/lib/api/types";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => { resetDb(); clearSession(); });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const GAO = 7;        // seeded: stock 14, cost 152000
const DRAFT_ID = 1;   // seeded draft: 10 x GAO @ 152000

function receive(id: number) {
  return api.POST("/api/v1/purchases/{id}/receive", { params: { path: { id } } });
}

describe("POST /purchases/{id}/receive", () => {
  it("moves DRAFT to RECEIVED, raises stock and records a PURCHASE movement (BR3)", async () => {
    await login("thukho", "stock123");
    const before = db.products.find((p) => p.id === GAO)!.stockQty;

    const purchase = unwrap<PurchaseDetailResponse>(await receive(DRAFT_ID));

    expect(purchase.status).toBe("RECEIVED");
    expect(purchase.receivedAt).toBeTruthy();
    expect(db.products.find((p) => p.id === GAO)!.stockQty).toBe(before + 10);

    const movements = unwrapList<MovementResponse>(
      await api.GET("/api/v1/inventory/movements", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(movements.items[0].movementType).toBe("PURCHASE");
    expect(movements.items[0].quantityChange).toBe(10);
  });

  it("keeps cost unchanged when the purchase price equals the current cost (BR11)", async () => {
    await login("thukho", "stock123");
    await receive(DRAFT_ID);
    expect(db.products.find((p) => p.id === GAO)!.costPrice).toBe(152000);
  });

  it("recomputes weighted-average cost when the purchase price differs (BR11)", async () => {
    await login("thukho", "stock123");
    // 14 @ 152000 existing, receive 14 @ 180000 -> (14*152000 + 14*180000)/28 = 166000
    const created = unwrap<PurchaseDetailResponse>(
      await api.POST("/api/v1/purchases", {
        body: { supplierId: 1, items: [{ productId: GAO, quantity: 14, unitCost: 180000 }] } as never,
      }),
    );
    await receive(created.id);
    expect(db.products.find((p) => p.id === GAO)!.costPrice).toBe(166000);
  });

  it("refuses a second receive so stock is never doubled (UC-03 E3)", async () => {
    await login("thukho", "stock123");
    await receive(DRAFT_ID);
    const after = db.products.find((p) => p.id === GAO)!.stockQty;

    const { response, error } = await receive(DRAFT_ID);
    expect(response.status).toBe(409);
    expect((error as unknown as { error: { code: string } }).error.code).toBe("PURCHASE_ALREADY_RECEIVED");
    expect(db.products.find((p) => p.id === GAO)!.stockQty).toBe(after);
  });

  it("refuses to receive a draft whose supplier was deactivated (UC-03 E1)", async () => {
    await login("admin", "admin123");
    await api.POST("/api/v1/suppliers/{id}/deactivate", { params: { path: { id: 1 } } });

    const { response, error } = await receive(DRAFT_ID);
    expect(response.status).toBe(422);
    expect((error as unknown as { error: { code: string } }).error.code).toBe("SUPPLIER_INACTIVE");
  });

  it("refuses to receive a draft whose product was deactivated (UC-03 E1)", async () => {
    await login("admin", "admin123");
    await api.POST("/api/v1/products/{id}/deactivate", { params: { path: { id: GAO } } });

    const { response, error } = await receive(DRAFT_ID);
    expect(response.status).toBe(422);
    expect((error as unknown as { error: { code: string } }).error.code).toBe("PRODUCT_UNAVAILABLE");
  });

  it("cancels a draft without touching stock, and refuses to cancel twice", async () => {
    await login("thukho", "stock123");
    const before = db.products.find((p) => p.id === GAO)!.stockQty;

    const cancelled = unwrap<PurchaseDetailResponse>(
      await api.POST("/api/v1/purchases/{id}/cancel", { params: { path: { id: DRAFT_ID } } }),
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(db.products.find((p) => p.id === GAO)!.stockQty).toBe(before);

    const again = await api.POST("/api/v1/purchases/{id}/cancel", { params: { path: { id: DRAFT_ID } } });
    expect(again.response.status).toBe(409);
  });

  it("refuses to cancel a received purchase", async () => {
    await login("thukho", "stock123");
    await receive(DRAFT_ID);
    const { response } = await api.POST("/api/v1/purchases/{id}/cancel", { params: { path: { id: DRAFT_ID } } });
    expect(response.status).toBe(409);
  });

  it("rejects a zero or negative quantity line (UC-03 E2)", async () => {
    await login("thukho", "stock123");
    const { response, error } = await api.POST("/api/v1/purchases", {
      body: { supplierId: 1, items: [{ productId: GAO, quantity: 0, unitCost: 1000 }] } as never,
    });
    expect(response.status).toBe(422);
    expect((error as unknown as { error: { code: string } }).error.code).toBe("INVALID_QUANTITY");
  });

  it("rejects a negative unit cost (UC-03 E2)", async () => {
    await login("thukho", "stock123");
    const { response, error } = await api.POST("/api/v1/purchases", {
      body: { supplierId: 1, items: [{ productId: GAO, quantity: 1, unitCost: -5 }] } as never,
    });
    expect(response.status).toBe(422);
    expect((error as unknown as { error: { code: string } }).error.code).toBe("INVALID_PURCHASE_LINE");
  });

  it("replaces the whole line list on PATCH rather than merging", async () => {
    await login("thukho", "stock123");
    const updated = unwrap<PurchaseDetailResponse>(
      await api.PATCH("/api/v1/purchases/{id}", {
        params: { path: { id: DRAFT_ID } },
        body: { items: [{ productId: 1, quantity: 2, unitCost: 8000 }] } as never,
      }),
    );
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].productId).toBe(1);
    expect(updated.total).toBe(16000);
  });

  it("refuses a cashier the purchase module entirely", async () => {
    await login("thungan", "cashier123");
    const { response } = await api.GET("/api/v1/purchases", { params: { query: { page: 1, pageSize: 20 } } });
    expect(response.status).toBe(403);
  });
});
