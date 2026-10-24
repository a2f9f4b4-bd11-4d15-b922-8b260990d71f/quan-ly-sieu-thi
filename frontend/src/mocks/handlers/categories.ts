import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";

export const categoryHandlers = [
  http.get(`${BASE}/categories`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request);
    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive");
    let rows = db.categories.filter((c) => matchesSearch([c.name], url.searchParams.get("search")));
    if (isActive !== null) rows = rows.filter((c) => c.isActive === (isActive === "true"));

    const { items, meta } = paginate(
      rows,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.post(`${BASE}/categories`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const body = (await request.json()) as { name: string; description?: string };

    if (db.categories.some((c) => c.name.toLowerCase() === body.name.toLowerCase())) {
      return fail(409, "DUPLICATE_VALUE", "Tên danh mục đã tồn tại.", { fields: ["name"] });
    }

    const now = new Date().toISOString();
    const category = {
      id: nextId(db.categories), name: body.name, description: body.description ?? "",
      isActive: true, createdAt: now, updatedAt: now,
    };
    db.categories.push(category);
    persist();
    return ok(category, 201);
  })),

  http.get(`${BASE}/categories/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request);
    const category = db.categories.find((c) => c.id === Number(params.id));
    if (!category) return fail(404, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục.");
    return ok(category);
  })),

  http.patch(`${BASE}/categories/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const category = db.categories.find((c) => c.id === Number(params.id));
    if (!category) return fail(404, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục.");

    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(category, body, { updatedAt: new Date().toISOString() });
    persist();
    return ok(category);
  })),

  ...(["activate", "deactivate"] as const).map((action) =>
    http.post(`${BASE}/categories/:id/${action}`, guard(async ({ request, params }) => {
      await simulateLatency();
      actingUser(request, ["ADMIN", "STOCKKEEPER"]);
      const category = db.categories.find((c) => c.id === Number(params.id));
      if (!category) return fail(404, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục.");
      category.isActive = action === "activate";
      category.updatedAt = new Date().toISOString();
      persist();
      return ok(category);
    })),
  ),
];
