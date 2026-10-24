import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";

/** Phone is normalised to 10–11 digits beginning with 0, matching the backend. */
function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!/^0\d{9,10}$/.test(digits)) return null;
  return digits;
}

export const customerHandlers = [
  http.get(`${BASE}/customers`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const url = new URL(request.url);
    const rows = db.customers.filter((c) =>
      matchesSearch([c.fullName, c.customerCode, c.phone], url.searchParams.get("search")),
    );
    const { items, meta } = paginate(
      rows,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.get(`${BASE}/customers/lookup`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    const customer = db.customers.find((c) => c.phone === q || c.customerCode === q);
    if (!customer) return fail(404, "CUSTOMER_NOT_FOUND", `Không tìm thấy khách hàng "${q}".`);
    return ok(customer);
  })),

  http.post(`${BASE}/customers`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const body = (await request.json()) as { fullName: string; phone?: string; email?: string };
    const phone = normalizePhone(body.phone);

    if (body.phone && !phone) {
      return fail(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", [
        { field: "phone", messages: ["Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0."] },
      ]);
    }
    if (phone && db.customers.some((c) => c.phone === phone)) {
      return fail(409, "DUPLICATE_VALUE", "Số điện thoại đã thuộc về khách hàng khác.", { fields: ["phone"] });
    }

    const id = nextId(db.customers);
    const now = new Date().toISOString();
    const customer = {
      id, customerCode: `KH${String(id).padStart(6, "0")}`,
      fullName: body.fullName, phone, email: body.email ?? "", loyaltyPoints: 0,
      createdAt: now, updatedAt: now,
    };
    db.customers.push(customer as never);
    persist();
    return ok(customer, 201);
  })),

  http.get(`${BASE}/customers/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const customer = db.customers.find((c) => c.id === Number(params.id));
    if (!customer) return fail(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
    return ok(customer);
  })),

  http.patch(`${BASE}/customers/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const customer = db.customers.find((c) => c.id === Number(params.id));
    if (!customer) return fail(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");

    const body = (await request.json()) as Record<string, unknown>;
    // Points are accrue-only: they may never be set through this endpoint.
    if ("loyaltyPoints" in body) {
      return fail(400, "VALIDATION_ERROR", "Không thể sửa điểm tích lũy.", [
        { field: "loyaltyPoints", messages: ["Điểm chỉ được cộng khi thanh toán."] },
      ]);
    }
    if (typeof body.phone === "string") {
      const phone = normalizePhone(body.phone);
      if (!phone) {
        return fail(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", [
          { field: "phone", messages: ["Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0."] },
        ]);
      }
      if (db.customers.some((c) => c.phone === phone && c.id !== customer.id)) {
        return fail(409, "DUPLICATE_VALUE", "Số điện thoại đã thuộc về khách hàng khác.", { fields: ["phone"] });
      }
      body.phone = phone;
    }
    Object.assign(customer, body, { updatedAt: new Date().toISOString() });
    persist();
    return ok(customer);
  })),
];
