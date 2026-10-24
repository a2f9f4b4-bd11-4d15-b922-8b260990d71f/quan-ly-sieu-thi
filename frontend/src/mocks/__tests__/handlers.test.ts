import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "../handlers";
import { resetDb } from "../db";
import { api, login, unwrap, unwrapList } from "@/lib/api/client";
import { clearSession } from "@/lib/api/session";
import { AppError } from "@/lib/api/errors";
import type { ProductResponse } from "@/lib/api/types";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => { resetDb(); clearSession(); });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("auth handlers", () => {
  it("logs in a seeded admin and returns the session user", async () => {
    const session = await login("admin", "admin123");
    expect(session.user.role).toBe("ADMIN");
    expect(session.user.fullName).toBe("Nguyễn Thái Bình");
    expect(session.accessToken).toBeTruthy();
  });

  it("rejects a wrong password with INVALID_CREDENTIALS", async () => {
    await expect(login("admin", "sai-mat-khau")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects a locked account with ACCOUNT_LOCKED", async () => {
    await expect(login("nghiviec", "locked123")).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
    });
  });

  it("rotates the refresh token so the old one cannot be replayed", async () => {
    const first = await login("admin", "admin123");
    const { data } = await api.POST("/api/v1/auth/refresh", {
      body: { refreshToken: first.refreshToken } as never,
    });
    expect(data).toBeTruthy();

    const replay = await api.POST("/api/v1/auth/refresh", {
      body: { refreshToken: first.refreshToken } as never,
    });
    expect(replay.response.status).toBe(401);
  });
});

describe("product handlers", () => {
  it("requires authentication", async () => {
    const { response } = await api.GET("/api/v1/products", {
      params: { query: { page: 1, pageSize: 20 } },
    });
    expect(response.status).toBe(401);
  });

  it("lists seeded products for an admin", async () => {
    await login("admin", "admin123");
    const page = unwrapList<ProductResponse>(
      await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(page.meta.total).toBe(15);
    expect(page.items.some((p) => p.sku === "COCA-330")).toBe(true);
  });

  it("filters by search across name, sku and barcode", async () => {
    await login("admin", "admin123");
    const page = unwrapList<ProductResponse>(
      await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20, search: "Hảo Hảo" } } }),
    );
    expect(page.meta.total).toBe(1);
    expect(page.items[0].sku).toBe("HAOHAO-TC");
  });

  it("omits costPrice entirely for a cashier", async () => {
    await login("thungan", "cashier123");
    const page = unwrapList<ProductResponse>(
      await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(page.items[0]).not.toHaveProperty("costPrice");
  });

  it("includes costPrice for a stockkeeper", async () => {
    await login("thukho", "stock123");
    const page = unwrapList<ProductResponse>(
      await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(page.items[0]).toHaveProperty("costPrice");
  });

  it("looks up a product by barcode or SKU for the scanner", async () => {
    await login("thungan", "cashier123");
    const product = unwrap<ProductResponse>(
      await api.GET("/api/v1/products/lookup", { params: { query: { code: "COCA-330" } } }),
    );
    expect(product.name).toBe("Coca-Cola lon 330ml");
  });

  it("returns PRODUCT_NOT_FOUND for an unknown code", async () => {
    await login("thungan", "cashier123");
    const result = await api.GET("/api/v1/products/lookup", {
      params: { query: { code: "KHONG-TON-TAI" } },
    });
    expect(result.response.status).toBe(404);
    expect(() => unwrap(result as never)).toThrowError(AppError);
  });

  it("refuses product writes from a cashier", async () => {
    await login("thungan", "cashier123");
    const { response } = await api.POST("/api/v1/products/{id}/deactivate", {
      params: { path: { id: 1 } },
    });
    expect(response.status).toBe(403);
  });
});

describe("category handlers", () => {
  it("lists seeded categories", async () => {
    await login("admin", "admin123");
    const page = unwrapList<{ id: number; name: string }>(
      await api.GET("/api/v1/categories", { params: { query: { page: 1, pageSize: 20 } } }),
    );
    expect(page.meta.total).toBe(8);
  });
});
