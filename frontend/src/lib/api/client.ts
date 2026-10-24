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

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const session = getSession();
    if (session) request.headers.set("Authorization", `Bearer ${session.accessToken}`);
    return request;
  },

  async onResponse({ request, response }) {
    if (response.status !== 401) return response;
    // Never try to refresh a refresh.
    if (request.url.includes("/auth/refresh") || request.url.includes("/auth/login")) {
      return response;
    }

    try {
      const next = await refreshOnce(refreshRequest);
      const replay = new Request(request, { headers: new Headers(request.headers) });
      replay.headers.set("Authorization", `Bearer ${next.accessToken}`);
      return await fetch(replay);
    } catch {
      clearSession();
      return response;
    }
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
