import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "../handlers";
import { db, resetDb } from "../db";
import { api, login, unwrap, unwrapList } from "@/lib/api/client";
import { clearSession } from "@/lib/api/session";
import type { MovementResponse, StockCountResultResponse } from "@/lib/api/types";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => { resetDb(); clearSession(); });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const COCA = 1; // seeded stock 96, cost 8000

function count(body: Record<string, unknown>) {
  return api.POST("/api/v1/inventory/stock-counts", { body: body as never });
}

describe("POST /inventory/stock-counts", () => {
  it("adjusts stock by the difference and writes an ADJUSTMENT movement", async () => {
    await login("thukho", "stock123");
    const result = unwrap<StockCountResultResponse>(
      await count({ productId: COCA, countedQty: 94, reason: "Hàng hỏng", expectedSystemQty: 96 }),
    );

    expect(result.stockCount.countNo).toMatch(/^KK\d{12}$/);
    expect(result.stockCount.systemQty).toBe(96);
    expect(result.stockCount.countedQty).toBe(94);
    expect(result.stockCount.difference).toBe(-2);
    expect(db.products.find((p) => p.id === COCA)!.stockQty).toBe(94);

    const movements = unwrapList<MovementResponse>(
      await api.GET("/api/v1/inventory/movements", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(movements.items[0].movementType).toBe("ADJUSTMENT");
    expect(movements.items[0].quantityChange).toBe(-2);
  });

  it("never changes cost price (BR11)", async () => {
    await login("thukho", "stock123");
    await count({ productId: COCA, countedQty: 50, reason: "Kiểm kê định kỳ", expectedSystemQty: 96 });
    expect(db.products.find((p) => p.id === COCA)!.costPrice).toBe(8000);
  });

  it("rejects a stale expectedSystemQty with both numbers (UC-04 E2)", async () => {
    await login("thungan", "cashier123");
    // a sale moves stock under the counter's feet
    await api.POST("/api/v1/sales", {
      body: { items: [{ productId: COCA, quantity: 1 }], payments: [{ method: "CASH", amount: 12000 }] } as never,
    });

    await login("thukho", "stock123");
    const { response, error } = await count({
      productId: COCA, countedQty: 90, reason: "Kiểm kê", expectedSystemQty: 96,
    });

    expect(response.status).toBe(409);
    const body = error as unknown as { code: string; details: { expectedSystemQty: number; currentStockQty: number } };
    expect(body.code).toBe("STOCK_CONFLICT");
    expect(body.details.expectedSystemQty).toBe(96);
    expect(body.details.currentStockQty).toBe(95);
    // nothing was adjusted
    expect(db.products.find((p) => p.id === COCA)!.stockQty).toBe(95);
    expect(db.stockCounts).toHaveLength(0);
  });

  it("succeeds after the operator reloads the current quantity", async () => {
    await login("thungan", "cashier123");
    await api.POST("/api/v1/sales", {
      body: { items: [{ productId: COCA, quantity: 1 }], payments: [{ method: "CASH", amount: 12000 }] } as never,
    });

    await login("thukho", "stock123");
    const result = unwrap<StockCountResultResponse>(
      await count({ productId: COCA, countedQty: 90, reason: "Kiểm kê", expectedSystemQty: 95 }),
    );
    expect(result.stockCount.difference).toBe(-5);
    expect(db.products.find((p) => p.id === COCA)!.stockQty).toBe(90);
  });

  it("requires a reason (UC-04 E3)", async () => {
    await login("thukho", "stock123");
    const { response, error } = await count({
      productId: COCA, countedQty: 90, reason: "   ", expectedSystemQty: 96,
    });
    expect(response.status).toBe(400);
    expect((error as unknown as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a negative count (UC-04 E1)", async () => {
    await login("thukho", "stock123");
    const { response } = await count({
      productId: COCA, countedQty: -1, reason: "Sai", expectedSystemQty: 96,
    });
    expect(response.status).toBe(422);
  });

  it("writes no movement when the count matches the system exactly", async () => {
    await login("thukho", "stock123");
    const result = unwrap<StockCountResultResponse>(
      await count({ productId: COCA, countedQty: 96, reason: "Khớp", expectedSystemQty: 96 }),
    );
    expect(result.stockCount.difference).toBe(0);
    expect(db.movements).toHaveLength(0);
    expect(db.stockCounts).toHaveLength(1);
  });

  it("refuses a cashier", async () => {
    await login("thungan", "cashier123");
    const { response } = await count({
      productId: COCA, countedQty: 90, reason: "Kiểm kê", expectedSystemQty: 96,
    });
    expect(response.status).toBe(403);
  });
});
