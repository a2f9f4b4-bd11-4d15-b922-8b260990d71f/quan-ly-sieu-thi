import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "../handlers";
import { db, resetDb } from "../db";
import { api, login, unwrap, unwrapList } from "@/lib/api/client";
import { clearSession } from "@/lib/api/session";
import type { SaleDetailResponse, MovementResponse } from "@/lib/api/types";
import type { Receipt } from "@/features/sales/api";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => { resetDb(); clearSession(); });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const COCA = 1;      // salePrice 12000, stock 96
const PEPSI = 2;     // salePrice 11000, stock 8

function sell(body: Record<string, unknown>) {
  return api.POST("/api/v1/sales", { body: body as never });
}

describe("POST /sales — the checkout transaction", () => {
  it("writes an invoice, deducts stock and records a SALE movement", async () => {
    await login("thungan", "cashier123");
    const before = db.products.find((p) => p.id === COCA)!.stockQty;

    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 3 }],
        payments: [{ method: "CASH", amount: 36000, tenderedAmount: 50000 }],
      }),
    );

    expect(sale.invoiceNo).toMatch(/^HD\d{12}$/);
    expect(sale.subtotal).toBe(36000);
    expect(sale.total).toBe(36000);
    expect(sale.status).toBe("PAID");
    expect(sale.payments[0].changeAmount).toBe(14000);
    expect(db.products.find((p) => p.id === COCA)!.stockQty).toBe(before - 3);

    // The movement ledger is admin/stockkeeper only — the cashier who just sold
    // cannot read it, so re-authenticate to verify the ledger entry.
    await login("admin", "admin123");
    const movements = unwrapList<MovementResponse>(
      await api.GET("/api/v1/inventory/movements", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(movements.items[0].movementType).toBe("SALE");
    expect(movements.items[0].quantityChange).toBe(-3);
  });

  it("snapshots name, sku and cost on each line (BR5, BR11)", async () => {
    await login("thungan", "cashier123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 12000 }],
      }),
    );
    expect(sale.items[0].skuSnapshot).toBe("COCA-330");
    expect(sale.items[0].nameSnapshot).toBe("Coca-Cola lon 330ml");
    expect(sale.items[0].unitCostSnapshot).toBe(8000);
  });

  it("awards floor(total/10000) points to an attached customer (BR6)", async () => {
    await login("thungan", "cashier123");
    const before = db.customers.find((c) => c.id === 1)!.loyaltyPoints;

    const sale = unwrap<SaleDetailResponse>(
      await sell({
        customerId: 1,
        items: [{ productId: COCA, quantity: 3 }],
        payments: [{ method: "CASH", amount: 36000 }],
      }),
    );

    expect(sale.pointsEarned).toBe(3);
    expect(db.customers.find((c) => c.id === 1)!.loyaltyPoints).toBe(before + 3);
  });

  it("awards no points when no customer is attached", async () => {
    await login("thungan", "cashier123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 3 }],
        payments: [{ method: "CASH", amount: 36000 }],
      }),
    );
    expect(sale.pointsEarned).toBe(0);
  });

  it("rejects an oversell with per-product availability and writes nothing (BR1)", async () => {
    await login("thungan", "cashier123");
    const before = db.products.find((p) => p.id === PEPSI)!.stockQty;

    const { response, error } = await sell({
      items: [{ productId: PEPSI, quantity: 20 }],
      payments: [{ method: "CASH", amount: 220000 }],
    });

    expect(response.status).toBe(409);
    const details = (error as unknown as { details: Array<{ available: number; requested: number }> }).details;
    expect(details[0]).toMatchObject({ requested: 20, available: 8 });
    expect(db.products.find((p) => p.id === PEPSI)!.stockQty).toBe(before);
    expect(db.sales).toHaveLength(0);
  });

  it("caps a cashier discount at 10% and reports the maximum (BR7)", async () => {
    await login("thungan", "cashier123");
    const { response, error } = await sell({
      items: [{ productId: COCA, quantity: 1 }],   // subtotal 12000
      discountAmount: 10000,
      payments: [{ method: "CASH", amount: 2000 }],
    });

    expect(response.status).toBe(422);
    const body = error as unknown as { code: string; details: { maxDiscountAmount: number } };
    expect(body.code).toBe("INVALID_DISCOUNT");
    expect(body.details.maxDiscountAmount).toBe(1200);
  });

  it("allows an admin the same discount a cashier is refused", async () => {
    await login("admin", "admin123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 1 }],
        discountAmount: 10000,
        payments: [{ method: "CASH", amount: 2000 }],
      }),
    );
    expect(sale.total).toBe(2000);
  });

  it("rejects payments that do not sum exactly to the total", async () => {
    await login("thungan", "cashier123");
    const { response, error } = await sell({
      items: [{ productId: COCA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 10000 }],
    });
    expect(response.status).toBe(422);
    expect((error as unknown as { code: string }).code).toBe("INVALID_PAYMENT");
  });

  it("accepts a split payment that sums to the total", async () => {
    await login("thungan", "cashier123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 3 }],
        payments: [
          { method: "CASH", amount: 20000 },
          { method: "TRANSFER", amount: 16000, reference: "FT26102012345" },
        ],
      }),
    );
    expect(sale.payments).toHaveLength(2);
    expect(sale.total).toBe(36000);
  });

  it("allocates an invoice discount across lines so the parts sum back (BR7)", async () => {
    await login("admin", "admin123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 1 }, { productId: PEPSI, quantity: 1 }],
        discountAmount: 1000,
        payments: [{ method: "CASH", amount: 22000 }],
      }),
    );
    const allocated = sale.items.reduce((sum, i) => sum + i.discountAmount, 0);
    expect(allocated).toBe(1000);
  });

  it("merges duplicate cart lines for the same product", async () => {
    await login("thungan", "cashier123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        items: [{ productId: COCA, quantity: 2 }, { productId: COCA, quantity: 1 }],
        payments: [{ method: "CASH", amount: 36000 }],
      }),
    );
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].quantity).toBe(3);
  });

  it("refuses to sell a deactivated product", async () => {
    await login("admin", "admin123");
    await api.POST("/api/v1/products/{id}/deactivate", { params: { path: { id: COCA } } });

    const { response, error } = await sell({
      items: [{ productId: COCA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 12000 }],
    });
    expect(response.status).toBe(422);
    expect((error as unknown as { code: string }).code).toBe("PRODUCT_UNAVAILABLE");
  });

  it("reprints without creating a second invoice (UC-02 E7)", async () => {
    await login("thungan", "cashier123");
    const sale = unwrap<SaleDetailResponse>(
      await sell({
        customerId: 1,
        items: [{ productId: COCA, quantity: 3 }],
        payments: [{ method: "CASH", amount: 36000 }],
      }),
    );

    for (let i = 0; i < 3; i += 1) {
      const receipt = unwrap<Receipt>(
        await api.GET("/api/v1/sales/{id}/print", { params: { path: { id: sale.id } } }),
      );
      expect(receipt.invoiceNo).toBe(sale.invoiceNo);
      expect(receipt.pointsEarned).toBe(3);
    }
    expect(db.sales).toHaveLength(1);
  });

  it("refuses a stockkeeper the POS entirely", async () => {
    await login("thukho", "stock123");
    const { response } = await sell({
      items: [{ productId: COCA, quantity: 1 }],
      payments: [{ method: "CASH", amount: 12000 }],
    });
    expect(response.status).toBe(403);
  });
});
