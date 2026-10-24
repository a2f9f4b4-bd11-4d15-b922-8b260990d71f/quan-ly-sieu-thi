import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { unwrap, api } from "../client";
import { setSession, clearSession, getSession } from "../session";
import { AppError } from "../errors";
import type { SessionUserResponse } from "../types";

const BASE = "http://localhost:3001";

const user: SessionUserResponse = {
  id: 1, username: "admin", fullName: "Quản lý", role: "ADMIN",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => clearSession());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("auth middleware", () => {
  it("attaches the access token as a bearer header", async () => {
    setSession({ accessToken: "tok-1", refreshToken: "r", user });
    const seen: string[] = [];

    server.use(
      http.get(`${BASE}/api/v1/products`, ({ request }) => {
        seen.push(request.headers.get("authorization") ?? "");
        return HttpResponse.json({ data: { items: [], meta: { page: 1, pageSize: 20, total: 0 } } });
      }),
    );

    await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } });
    expect(seen[0]).toBe("Bearer tok-1");
  });

  it("refreshes once on 401 and replays the original request", async () => {
    setSession({ accessToken: "stale", refreshToken: "r1", user });
    let refreshCalls = 0;
    let productCalls = 0;

    server.use(
      http.post(`${BASE}/api/v1/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          data: { accessToken: "fresh", refreshToken: "r2", user, expiresIn: 900 },
        });
      }),
      http.get(`${BASE}/api/v1/products`, ({ request }) => {
        productCalls += 1;
        if (request.headers.get("authorization") === "Bearer stale") {
          return HttpResponse.json(
            { error: { code: "UNAUTHENTICATED", message: "Hết phiên" } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ data: { items: [], meta: { page: 1, pageSize: 20, total: 0 } } });
      }),
    );

    const result = await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } });

    expect(refreshCalls).toBe(1);
    expect(productCalls).toBe(2);
    expect(result.response.status).toBe(200);
    expect(getSession()?.accessToken).toBe("fresh");
  });

  it("replays a request WITH A BODY after refreshing, preserving the payload", async () => {
    setSession({ accessToken: "stale", refreshToken: "r1", user });
    let refreshCalls = 0;
    const saleBodies: unknown[] = [];

    server.use(
      http.post(`${BASE}/api/v1/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          data: { accessToken: "fresh", refreshToken: "r2", user, expiresIn: 900 },
        });
      }),
      http.post(`${BASE}/api/v1/sales`, async ({ request }) => {
        saleBodies.push(await request.clone().json());
        if (request.headers.get("authorization") === "Bearer stale") {
          return HttpResponse.json(
            { error: { code: "UNAUTHENTICATED", message: "Hết phiên" } },
            { status: 401 },
          );
        }
        return HttpResponse.json({ data: { id: 1, invoiceNo: "HD202610240001" } }, { status: 201 });
      }),
    );

    const payload = {
      items: [{ productId: 1, quantity: 3 }],
      payments: [{ method: "CASH", amount: 36000 }],
    };
    const result = await api.POST("/api/v1/sales", { body: payload as never });

    // The cashier's sale must actually land, not vanish with the session.
    expect(refreshCalls).toBe(1);
    expect(saleBodies).toHaveLength(2);
    expect(saleBodies[1]).toEqual(payload);
    expect(result.response.status).toBe(201);
    expect(getSession()?.accessToken).toBe("fresh");
  });

  it("keeps the session when the refresh fails for a non-auth reason", async () => {
    setSession({ accessToken: "stale", refreshToken: "r1", user });

    server.use(
      // A transient 500 is not a revoked token — the session must survive.
      http.post(`${BASE}/api/v1/auth/refresh`, () =>
        HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ" } }, { status: 500 }),
      ),
      http.get(`${BASE}/api/v1/products`, () =>
        HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Hết phiên" } }, { status: 401 }),
      ),
    );

    await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } });
    expect(getSession()).not.toBeNull();
  });

  it("clears the session when the refresh itself fails", async () => {
    setSession({ accessToken: "stale", refreshToken: "bad", user });

    server.use(
      http.post(`${BASE}/api/v1/auth/refresh`, () =>
        HttpResponse.json(
          { error: { code: "INVALID_REFRESH_TOKEN", message: "Token không hợp lệ" } },
          { status: 401 },
        ),
      ),
      http.get(`${BASE}/api/v1/products`, () =>
        HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Hết phiên" } }, { status: 401 }),
      ),
    );

    await api.GET("/api/v1/products", { params: { query: { page: 1, pageSize: 20 } } });
    expect(getSession()).toBeNull();
  });
});

describe("unwrap", () => {
  it("returns the data payload on success", () => {
    const value = unwrap({
      data: { data: { id: 7 } },
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);
    expect(value).toEqual({ id: 7 });
  });

  it("throws a typed AppError on failure", () => {
    expect(() =>
      unwrap({
        data: undefined,
        error: { error: { code: "NOT_FOUND", message: "Không tìm thấy" } },
        response: new Response(null, { status: 404 }),
      } as never),
    ).toThrowError(AppError);
  });
});
