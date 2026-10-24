import { http } from "msw";
import { db, persist, syncFromStorage, type MockUser } from "../db";
import { BASE, ok, fail, simulateLatency, actingUser, guard } from "./_shared";

const ACCESS_TTL_MS = 60_000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let tokenCounter = 0;
function issue(userId: number, ttl: number) {
  const token = `tok-${++tokenCounter}-${Math.random().toString(36).slice(2)}`;
  db.tokens[token] = { userId, expiresAt: Date.now() + ttl };
  persist();
  return token;
}

/** The auth endpoints return SessionUserResponse — never the full user record. */
function sessionUser(u: MockUser) {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role };
}

export const authHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await simulateLatency();
    syncFromStorage();
    const { username, password } = (await request.json()) as { username: string; password: string };

    const user = db.users.find((u) => u.username === username.toLowerCase());
    if (!user || user.password !== password) {
      return fail(401, "INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng.");
    }
    if (!user.isActive) {
      return fail(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa. Vui lòng liên hệ quản lý.");
    }

    return ok({
      tokenType: "Bearer",
      accessToken: issue(user.id, ACCESS_TTL_MS),
      refreshToken: issue(user.id, REFRESH_TTL_MS),
      expiresIn: ACCESS_TTL_MS / 1000,
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
      user: sessionUser(user),
    });
  }),

  http.post(`${BASE}/auth/refresh`, async ({ request }) => {
    await simulateLatency();
    syncFromStorage();
    const { refreshToken } = (await request.json()) as { refreshToken: string };
    const entry = db.tokens[refreshToken];

    if (!entry || entry.expiresAt < Date.now()) {
      return fail(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập không còn hiệu lực.");
    }

    // Single-use with rotation: the old token dies here. Replaying it fails.
    delete db.tokens[refreshToken];
    const user = db.users.find((u) => u.id === entry.userId)!;

    return ok({
      tokenType: "Bearer",
      accessToken: issue(user.id, ACCESS_TTL_MS),
      refreshToken: issue(user.id, REFRESH_TTL_MS),
      expiresIn: ACCESS_TTL_MS / 1000,
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
      user: sessionUser(user),
    });
  }),

  http.get(`${BASE}/auth/me`, guard(async ({ request }) => {
    await simulateLatency();
    return ok(sessionUser(actingUser(request)));
  })),

  http.post(`${BASE}/auth/logout`, guard(async ({ request }) => {
    const header = request.headers.get("authorization") ?? "";
    delete db.tokens[header.replace("Bearer ", "")];
    persist();
    return ok({ success: true });
  })),
];
