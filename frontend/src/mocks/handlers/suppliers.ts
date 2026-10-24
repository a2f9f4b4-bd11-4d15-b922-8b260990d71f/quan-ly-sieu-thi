import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";

const WRITERS = ["ADMIN", "STOCKKEEPER"] as const;

export const supplierHandlers = [
  http.get(`${BASE}/suppliers`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive");
    let rows = db.suppliers.filter((s) =>
      matchesSearch([s.name, s.phone, s.email], url.searchParams.get("search")),
    );
    if (isActive !== null) rows = rows.filter((s) => s.isActive === (isActive === "true"));

    const { items, meta } = paginate(
      rows,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.post(`${BASE}/suppliers`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const body = (await request.json()) as Record<string, string | undefined>;
    if (db.suppliers.some((s) => s.name.toLowerCase() === (body.name ?? "").toLowerCase())) {
      return fail(409, "DUPLICATE_VALUE", "Tên nhà cung cấp đã tồn tại.", { fields: ["name"] });
    }
    const now = new Date().toISOString();
    const supplier = {
      id: nextId(db.suppliers), name: String(body.name), phone: body.phone ?? "",
      email: body.email ?? "", address: body.address ?? "", note: body.note ?? "",
      isActive: true, createdAt: now, updatedAt: now,
    };
    db.suppliers.push(supplier as never);
    persist();
    return ok(supplier, 201);
  })),

  http.get(`${BASE}/suppliers/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const supplier = db.suppliers.find((s) => s.id === Number(params.id));
    if (!supplier) return fail(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp.");
    return ok(supplier);
  })),

  http.patch(`${BASE}/suppliers/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const supplier = db.suppliers.find((s) => s.id === Number(params.id));
    if (!supplier) return fail(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp.");
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(supplier, body, { updatedAt: new Date().toISOString() });
    persist();
    return ok(supplier);
  })),

  ...(["activate", "deactivate"] as const).map((action) =>
    http.post(`${BASE}/suppliers/:id/${action}`, guard(async ({ request, params }) => {
      await simulateLatency();
      actingUser(request, [...WRITERS]);
      const supplier = db.suppliers.find((s) => s.id === Number(params.id));
      if (!supplier) return fail(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp.");
      supplier.isActive = action === "activate";
      supplier.updatedAt = new Date().toISOString();
      persist();
      return ok(supplier);
    })),
  ),
];
