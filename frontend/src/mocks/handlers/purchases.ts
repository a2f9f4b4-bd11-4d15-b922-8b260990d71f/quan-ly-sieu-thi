import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId, nextSequence } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";
import { weightedAverageCost, nextDocumentNumber } from "../rules";
import { toStoreDateString } from "@/lib/format/datetime";

const WRITERS = ["ADMIN", "STOCKKEEPER"] as const;

function detail(purchase: (typeof db.purchases)[number]) {
  const supplier = db.suppliers.find((s) => s.id === purchase.supplierId);
  const creator = db.users.find((u) => u.id === purchase.createdBy);
  return {
    ...purchase,
    supplier: supplier ? { id: supplier.id, name: supplier.name, phone: supplier.phone } : undefined,
    creator: creator ? { id: creator.id, fullName: creator.fullName } : undefined,
    items: purchase.items.map((i) => {
      const product = db.products.find((p) => p.id === i.productId);
      return {
        ...i, purchaseId: purchase.id,
        product: product
          ? { id: product.id, sku: product.sku, name: product.name, unit: product.unit }
          : undefined,
      };
    }),
  };
}

export const purchaseHandlers = [
  http.post(`${BASE}/purchases/:id/receive`, guard(async ({ request, params }) => {
    await simulateLatency();
    const user = actingUser(request, [...WRITERS]);
    const purchase = db.purchases.find((p) => p.id === Number(params.id));
    if (!purchase) return fail(404, "PURCHASE_NOT_FOUND", "Không tìm thấy phiếu nhập.");

    // BR3 — only DRAFT → RECEIVED increases stock. A second receive must not double it.
    if (purchase.status === "RECEIVED") {
      return fail(409, "PURCHASE_ALREADY_RECEIVED", "Phiếu nhập đã được nhận hàng trước đó.");
    }
    if (purchase.status === "CANCELLED") {
      return fail(409, "PURCHASE_CANCELLED", "Phiếu nhập đã bị hủy.");
    }

    const supplier = db.suppliers.find((s) => s.id === purchase.supplierId);
    if (!supplier?.isActive) {
      return fail(422, "SUPPLIER_INACTIVE", "Nhà cung cấp đã ngừng hoạt động.");
    }
    for (const item of purchase.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Sản phẩm trong phiếu không tồn tại.");
      if (!product.isActive) {
        return fail(422, "PRODUCT_UNAVAILABLE", `Sản phẩm "${product.name}" đã ngừng bán.`);
      }
    }

    const nowIso = new Date().toISOString();
    for (const item of purchase.items) {
      const product = db.products.find((p) => p.id === item.productId)!;
      // BR11 — weighted average cost, recomputed before stock changes.
      product.costPrice = weightedAverageCost(
        product.stockQty, product.costPrice ?? 0, item.quantity, item.unitCost,
      );
      product.stockQty += item.quantity;
      product.updatedAt = nowIso;

      db.movements.push({
        id: nextId(db.movements), productId: product.id, type: "PURCHASE",
        quantity: item.quantity, referenceType: "PURCHASE", referenceId: purchase.id,
        createdBy: user.id, createdAt: nowIso,
      });
    }

    purchase.status = "RECEIVED";
    purchase.receivedAt = nowIso;
    purchase.receivedBy = user.id;
    persist();
    return ok(detail(purchase));
  })),

  http.post(`${BASE}/purchases/:id/cancel`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const purchase = db.purchases.find((p) => p.id === Number(params.id));
    if (!purchase) return fail(404, "PURCHASE_NOT_FOUND", "Không tìm thấy phiếu nhập.");
    if (purchase.status === "RECEIVED") {
      return fail(409, "PURCHASE_ALREADY_RECEIVED", "Phiếu đã nhận hàng, không thể hủy.");
    }
    if (purchase.status === "CANCELLED") {
      return fail(409, "PURCHASE_CANCELLED", "Phiếu nhập đã bị hủy.");
    }
    purchase.status = "CANCELLED"; // Drafts never touched stock, so nothing to reverse.
    persist();
    return ok(detail(purchase));
  })),

  http.post(`${BASE}/purchases`, guard(async ({ request }) => {
    await simulateLatency();
    const user = actingUser(request, [...WRITERS]);
    const body = (await request.json()) as {
      supplierId: number; note?: string; receiveNow?: boolean;
      items: Array<{ productId: number; quantity: number; unitCost: number }>;
    };

    const supplier = db.suppliers.find((s) => s.id === body.supplierId);
    if (!supplier) return fail(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp.");
    if (!supplier.isActive) return fail(422, "SUPPLIER_INACTIVE", "Nhà cung cấp đã ngừng hoạt động.");
    if (!body.items?.length) {
      return fail(400, "VALIDATION_ERROR", "Phiếu nhập phải có ít nhất một dòng hàng.", [
        { field: "items", messages: ["Cần ít nhất một sản phẩm."] },
      ]);
    }
    for (const [index, item] of body.items.entries()) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return fail(422, "INVALID_QUANTITY", "Số lượng phải là số nguyên lớn hơn 0.", [{ productId: item.productId }]);
      }
      if (item.unitCost < 0) {
        return fail(422, "INVALID_PURCHASE_LINE", `Dòng ${index + 1}: giá nhập không được âm.`, [{ productId: item.productId }]);
      }
    }

    const now = new Date();
    const subtotal = body.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    const purchase = {
      id: nextId(db.purchases),
      purchaseNo: nextDocumentNumber("PN", now, nextSequence(`PN-${toStoreDateString(now)}`)),
      supplierId: supplier.id, createdBy: user.id, status: "DRAFT" as const,
      subtotal, total: subtotal, note: body.note, receivedAt: null, receivedBy: null,
      createdAt: now.toISOString(),
      items: body.items.map((i, idx) => ({
        id: idx + 1, productId: i.productId, quantity: i.quantity,
        unitCost: i.unitCost, lineTotal: i.quantity * i.unitCost,
      })),
    };
    db.purchases.push(purchase);
    persist();
    return ok(detail(purchase), 201);
  })),

  http.get(`${BASE}/purchases`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const url = new URL(request.url);
    let rows = [...db.purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const status = url.searchParams.get("status");
    if (status) rows = rows.filter((p) => p.status === status);
    const supplierId = url.searchParams.get("supplierId");
    if (supplierId) rows = rows.filter((p) => p.supplierId === Number(supplierId));
    const search = url.searchParams.get("search");
    if (search) rows = rows.filter((p) => matchesSearch([p.purchaseNo], search));

    const { items, meta } = paginate(
      rows.map(detail),
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.get(`${BASE}/purchases/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const purchase = db.purchases.find((p) => p.id === Number(params.id));
    if (!purchase) return fail(404, "PURCHASE_NOT_FOUND", "Không tìm thấy phiếu nhập.");
    return ok(detail(purchase));
  })),

  http.patch(`${BASE}/purchases/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, [...WRITERS]);
    const purchase = db.purchases.find((p) => p.id === Number(params.id));
    if (!purchase) return fail(404, "PURCHASE_NOT_FOUND", "Không tìm thấy phiếu nhập.");
    if (purchase.status === "RECEIVED") return fail(409, "PURCHASE_ALREADY_RECEIVED", "Phiếu đã nhận hàng, không thể sửa.");
    if (purchase.status === "CANCELLED") return fail(409, "PURCHASE_CANCELLED", "Phiếu nhập đã bị hủy.");

    const body = (await request.json()) as {
      supplierId?: number;
      items?: Array<{ productId: number; quantity: number; unitCost: number }>;
    };
    if (body.supplierId) purchase.supplierId = body.supplierId;
    if (body.items) {
      // `items` is a full replace, never a merge.
      purchase.items = body.items.map((i, idx) => ({
        id: idx + 1, productId: i.productId, quantity: i.quantity,
        unitCost: i.unitCost, lineTotal: i.quantity * i.unitCost,
      }));
      purchase.subtotal = purchase.items.reduce((s, i) => s + i.lineTotal, 0);
      purchase.total = purchase.subtotal;
    }
    persist();
    return ok(detail(purchase));
  })),
];
