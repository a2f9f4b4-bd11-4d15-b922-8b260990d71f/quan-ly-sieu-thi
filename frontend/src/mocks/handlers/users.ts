import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId, type MockUser } from "../db";
import { BASE, ok, okList, okNoData, fail, simulateLatency, actingUser, guard } from "./_shared";

function publicUser(u: MockUser) {
  const { password: _password, ...rest } = u;
  return rest;
}

export const userHandlers = [
  http.get(`${BASE}/users`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const isActive = url.searchParams.get("isActive");

    let rows = db.users.filter((u) =>
      matchesSearch([u.username, u.fullName], url.searchParams.get("search")),
    );
    if (role) rows = rows.filter((u) => u.role === role);
    if (isActive !== null) rows = rows.filter((u) => u.isActive === (isActive === "true"));

    const { items, meta } = paginate(
      rows,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items.map(publicUser), meta);
  })),

  http.post(`${BASE}/users`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const body = (await request.json()) as {
      username: string; password: string; fullName: string; role: MockUser["role"];
    };
    const username = body.username.toLowerCase();

    if (db.users.some((u) => u.username === username)) {
      return fail(409, "DUPLICATE_VALUE", "Tên đăng nhập đã tồn tại.", { fields: ["username"] });
    }

    const now = new Date().toISOString();
    const user = {
      id: nextId(db.users), username, password: body.password,
      fullName: body.fullName, role: body.role,
      isActive: true, createdAt: now, updatedAt: now,
    } as MockUser;
    db.users.push(user);
    persist();
    return ok(publicUser(user), 201);
  })),

  http.get(`${BASE}/users/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const user = db.users.find((u) => u.id === Number(params.id));
    if (!user) return fail(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    return ok(publicUser(user));
  })),

  http.patch(`${BASE}/users/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const user = db.users.find((u) => u.id === Number(params.id));
    if (!user) return fail(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");

    const body = (await request.json()) as Record<string, unknown>;
    // Demoting the last active admin locks the store out of administration.
    if (body.role && body.role !== "ADMIN" && user.role === "ADMIN") {
      const activeAdmins = db.users.filter((u) => u.role === "ADMIN" && u.isActive);
      if (activeAdmins.length <= 1) {
        return fail(422, "LAST_ACTIVE_ADMIN", "Không thể đổi vai trò của quản lý đang hoạt động cuối cùng.");
      }
    }
    Object.assign(user, body, { updatedAt: new Date().toISOString() });
    persist();
    return ok(publicUser(user));
  })),

  http.post(`${BASE}/users/:id/lock`, guard(async ({ request, params }) => {
    await simulateLatency();
    const actor = actingUser(request, ["ADMIN"]);
    const target = db.users.find((u) => u.id === Number(params.id));
    if (!target) return fail(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");

    if (target.id === actor.id) {
      return fail(422, "CANNOT_LOCK_SELF", "Không thể khóa tài khoản của chính bạn.");
    }
    const activeAdmins = db.users.filter((u) => u.role === "ADMIN" && u.isActive);
    if (target.role === "ADMIN" && activeAdmins.length <= 1) {
      return fail(422, "LAST_ACTIVE_ADMIN", "Không thể khóa quản lý đang hoạt động cuối cùng.");
    }

    target.isActive = false;
    target.updatedAt = new Date().toISOString();
    persist();
    return ok(publicUser(target));
  })),

  http.post(`${BASE}/users/:id/unlock`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const target = db.users.find((u) => u.id === Number(params.id));
    if (!target) return fail(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    target.isActive = true;
    target.updatedAt = new Date().toISOString();
    persist();
    return ok(publicUser(target));
  })),

  http.post(`${BASE}/users/:id/reset-password`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const target = db.users.find((u) => u.id === Number(params.id));
    if (!target) return fail(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
    const body = (await request.json()) as { newPassword: string };
    target.password = body.newPassword;
    target.updatedAt = new Date().toISOString();
    persist();
    return okNoData();
  })),
];
