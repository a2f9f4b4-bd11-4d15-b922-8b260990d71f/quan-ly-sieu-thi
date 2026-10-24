import createClient, { type Middleware } from "openapi-fetch";
import type { paths, PageMeta, Paged } from "./types";
import { normalizeError, AppError } from "./errors";
import {
  getSession,
  setSession,
  clearSession,
  refreshOnce,
  type Session,
} from "./session";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/**
 * `fetch` is resolved at call time, not at module load. openapi-fetch otherwise
 * captures `globalThis.fetch` when the client is created, which freezes the
 * pristine implementation before MSW (browser worker or node server) patches it —
 * every mocked request would then escape to the real network.
 */
const lateBoundFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export const api = createClient<paths>({ baseUrl: BASE_URL, fetch: lateBoundFetch });

/** Raw client without the auth middleware, used for login and refresh. */
const bare = createClient<paths>({ baseUrl: BASE_URL, fetch: lateBoundFetch });

type AuthPayload = {
  data: { accessToken: string; refreshToken: string; user: Session["user"] };
};

async function refreshRequest(refreshToken: string): Promise<Session> {
  const { data, error, response } = await bare.POST("/api/v1/auth/refresh", {
    body: { refreshToken } as never,
  });
  if (error || !data) throw normalizeError(response.status, error);
  const payload = (data as AuthPayload).data;
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  };
}

/**
 * Pristine clones of in-flight requests, keyed by openapi-fetch's request id.
 *
 * openapi-fetch hands onResponse the SAME Request object it passed to fetch, so
 * its body is already consumed by then — `new Request(thatRequest)` throws for
 * anything with a payload. Without a clone taken before the fetch, a 401 on any
 * POST/PATCH would burn the rotated refresh token, drop the request, and log the
 * user out mid-action.
 */
const pendingClones = new Map<string, Request>();

const authMiddleware: Middleware = {
  async onRequest({ request, id }) {
    const session = getSession();
    if (session) request.headers.set("Authorization", `Bearer ${session.accessToken}`);
    // Only bodied requests need the clone; GETs can be rebuilt freely.
    if (request.body) pendingClones.set(id, request.clone());
    return request;
  },

  async onResponse({ request, response, id }) {
    const clone = pendingClones.get(id);
    pendingClones.delete(id);

    if (response.status !== 401) return response;
    // Never try to refresh a refresh.
    if (request.url.includes("/auth/refresh") || request.url.includes("/auth/login")) {
      return response;
    }

    let next: Session;
    try {
      next = await refreshOnce(refreshRequest);
    } catch (error) {
      // Only a rejected token means the session is gone. A 500, a network blip
      // or a timeout must leave the session intact so the caller can retry.
      if (error instanceof AppError && (error.status === 401 || error.status === 403)) {
        clearSession();
      }
      return response;
    }

    try {
      const replay = clone ?? new Request(request);
      replay.headers.set("Authorization", `Bearer ${next.accessToken}`);
      return await fetch(replay);
    } catch {
      // The refresh succeeded; surface the original 401 rather than killing a
      // session we just renewed.
      return response;
    }
  },

  async onError({ id }) {
    pendingClones.delete(id);
  },
};

api.use(authMiddleware);

type ApiResult<T> = { data?: { data: T }; error?: unknown; response: Response };
type ApiListResult<T> = {
  data?: { data: T[]; meta: PageMeta };
  error?: unknown;
  response: Response;
};

/** Unwraps a detail envelope `{ ..., data: T }`, throwing a typed AppError on failure. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.error || !result.data) {
    throw normalizeError(result.response?.status ?? 0, result.error);
  }
  return result.data.data;
}

/**
 * Unwraps a list envelope. In this contract `meta` is a SIBLING of `data`
 * (`{ data: T[], meta: {...} }`), not nested inside it — so list responses
 * cannot go through unwrap().
 */
export function unwrapList<T>(result: ApiListResult<T>): Paged<T> {
  if (result.error || !result.data) {
    throw normalizeError(result.response?.status ?? 0, result.error);
  }
  return { items: result.data.data, meta: result.data.meta };
}

/**
 * For endpoints whose success envelope has no `data` field at all
 * (e.g. POST /users/{id}/reset-password). Throws on failure, returns nothing.
 */
export function unwrapVoid(result: { error?: unknown; response: Response }): void {
  if (result.error) {
    throw normalizeError(result.response?.status ?? 0, result.error);
  }
}

export async function login(username: string, password: string): Promise<Session> {
  const { data, error, response } = await bare.POST("/api/v1/auth/login", {
    body: { username, password } as never,
  });
  if (error || !data) throw normalizeError(response.status, error);
  const payload = (data as AuthPayload).data;
  const session = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  };
  setSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await api.POST("/api/v1/auth/logout", {});
  } catch {
    // Logging out locally must succeed even if the server call fails.
  } finally {
    clearSession();
  }
}

export { AppError };
