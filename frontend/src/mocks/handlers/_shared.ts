import { HttpResponse, delay } from "msw";
import type { HttpResponseResolver } from "msw";
import { db, syncFromStorage } from "../db";
import type { Role } from "@/lib/api/types";

export const BASE = "*/api/v1";

/**
 * Mirrors the real latency band so loading states are built honestly.
 * Skipped under vitest: in node it only slows the suite, and no loading
 * state is being observed there.
 */
export async function simulateLatency() {
  if (process.env.VITEST) return;
  await delay(150 + Math.random() * 250);
}

let requestCounter = 0;

/** The contract's success envelope. `meta` is present only on list responses. */
export function ok(data: unknown, status = 200, meta?: unknown) {
  return HttpResponse.json(
    {
      success: true,
      statusCode: status,
      code: "OK",
      message: "Thành công",
      data,
      ...(meta ? { meta } : {}),
      requestId: `req-${++requestCounter}`,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

/**
 * Endpoints that succeed without a payload (e.g. reset-password). The contract still
 * marks `data` required and the live API sends `data: null`, so this emits it too —
 * a mock that is merely close enough is how the flat-envelope bug survived 154 tests.
 */
export function okNoData(status = 200) {
  return HttpResponse.json(
    {
      success: true,
      statusCode: status,
      code: "OK",
      message: "Thành công",
      data: null,
      requestId: `req-${++requestCounter}`,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

/** List responses put the rows in `data` and pagination in a sibling `meta`. */
export function okList(items: unknown[], meta: unknown, status = 200) {
  return ok(items, status, meta);
}

/** The contract's ErrorEnvelopeDto — flat, not nested under `error`. */
export function fail(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json(
    {
      success: false,
      statusCode: status,
      code,
      message,
      data: null,
      ...(details === undefined ? {} : { details }),
      requestId: `req-${++requestCounter}`,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

export class HandlerError extends Error {
  constructor(readonly response: Response) {
    super("handler error");
  }
}

/** Resolves the acting user from the bearer token, or throws a 401/403 response. */
export function actingUser(request: Request, allowed?: Role[]) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace("Bearer ", "");
  const entry = db.tokens[token];

  if (!entry || entry.expiresAt < Date.now()) {
    throw new HandlerError(fail(401, "UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn."));
  }

  const user = db.users.find((u) => u.id === entry.userId);
  if (!user || !user.isActive) {
    throw new HandlerError(fail(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa."));
  }
  if (allowed && !allowed.includes(user.role)) {
    throw new HandlerError(fail(403, "FORBIDDEN", "Không có quyền truy cập chức năng này."));
  }
  return user;
}

/** Wraps a resolver so a thrown HandlerError becomes its response. */
export function guard(fn: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    // Pick up writes made by other tabs before reading or mutating.
    syncFromStorage();
    try {
      return await fn(info);
    } catch (e) {
      if (e instanceof HandlerError) return e.response;
      throw e;
    }
  };
}

/** Forces the next matching request to fail. Demo and manual-testing aid only. */
let forcedFailure: { code: string; status: number; message: string } | null = null;

export function setForcedFailure(next: typeof forcedFailure) {
  forcedFailure = next;
}

export function takeForcedFailure(): Response | undefined {
  if (!forcedFailure) return undefined;
  const { status, code, message } = forcedFailure;
  forcedFailure = null; // fires once, then clears
  return fail(status, code, message);
}
