import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { unwrap, unwrapVoid, api, login } from "../client";
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
            { success: false, statusCode: 401, code: "UNAUTHENTICATED", message: "Hết phiên", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" },
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
            { success: false, statusCode: 401, code: "UNAUTHENTICATED", message: "Hết phiên", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" },
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
        HttpResponse.json({ success: false, statusCode: 500, code: "INTERNAL_ERROR", message: "Lỗi máy chủ", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" }, { status: 500 }),
      ),
      http.get(`${BASE}/api/v1/products`, () =>
        HttpResponse.json({ success: false, statusCode: 401, code: "UNAUTHENTICATED", message: "Hết phiên", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" }, { status: 401 }),
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
          { success: false, statusCode: 401, code: "INVALID_REFRESH_TOKEN", message: "Token không hợp lệ", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" },
          { status: 401 },
        ),
      ),
      http.get(`${BASE}/api/v1/products`, () =>
        HttpResponse.json({ success: false, statusCode: 401, code: "UNAUTHENTICATED", message: "Hết phiên", data: null, requestId: "req-test", timestamp: "2026-10-24T03:00:00.000Z" }, { status: 401 }),
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

  it("throws a typed AppError carrying the server's code and message", () => {
    let thrown: unknown;
    try {
      unwrap({
        data: undefined,
        error: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Không tìm thấy",
          data: null,
          requestId: "req-test",
          timestamp: "2026-10-24T03:00:00.000Z",
        },
        response: new Response(null, { status: 404 }),
      } as never);
    } catch (error) {
      thrown = error;
    }

    // Asserting only the class let this pass while the code silently degraded
    // to INTERNAL_ERROR — the very bug the flat-envelope fix was about.
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).code).toBe("NOT_FOUND");
    expect((thrown as AppError).message).toBe("Không tìm thấy");
    expect((thrown as AppError).status).toBe(404);
  });
});

describe("unwrapVoid", () => {
  it("returns for a successful empty response", () => {
    expect(() => unwrapVoid({ response: new Response(null, { status: 204 }) })).not.toThrow();
  });

  // openapi-fetch gives { error: undefined } when a non-ok response has no body,
  // so keying off `error` alone reported a failed call as a success.
  it("throws for a non-ok response that carried no body", () => {
    expect(() => unwrapVoid({ response: new Response(null, { status: 502 }) })).toThrowError(
      AppError,
    );
  });
})

describe("transport failures", () => {
  it("reports an unreachable server as SERVICE_UNAVAILABLE, not a generic error", async () => {
    server.use(http.get("http://localhost:3001/api/v1/products", () => HttpResponse.error()));
    setSession({ accessToken: "t", refreshToken: "r", user: { id: 1, role: "ADMIN" } as never });

    let thrown: unknown;
    try {
      unwrap(await api.GET("/api/v1/products", {} as never) as never);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).code).toBe("SERVICE_UNAVAILABLE");
    expect((thrown as AppError).message).toBe("Không kết nối được máy chủ.");
  });

  it("reports an unreachable server on the login path too", async () => {
    server.use(http.post("http://localhost:3001/api/v1/auth/login", () => HttpResponse.error()));

    await expect(login("admin", "admin123")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Không kết nối được máy chủ.",
    });
  });
});
