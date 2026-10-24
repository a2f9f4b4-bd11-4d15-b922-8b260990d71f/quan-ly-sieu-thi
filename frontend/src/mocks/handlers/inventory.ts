import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId, nextSequence, type MockMovement } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";
import { nextDocumentNumber } from "../rules";
import { toStoreDateString } from "@/lib/format/datetime";
import type { ProductResponse } from "@/lib/api/types";

function toStockItem(p: ProductResponse) {
  return {
    productId: p.id, sku: p.sku, barcode: p.barcode, name: p.name, unit: p.unit,
    categoryId: p.categoryId, categoryName: p.category?.name ?? "",
    stockQty: p.stockQty, reorderLevel: p.reorderLevel,
    isLowStock: p.stockQty <= p.reorderLevel, isActive: p.isActive,
  };
}

export const inventoryHandlers = [
  http.get(`${BASE}/inventory/stock`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request); // all three roles may see stock
    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive");
    const lowStock = url.searchParams.get("lowStock") === "true";
    const categoryId = url.searchParams.get("categoryId");

    let rows = db.products.filter((p) =>
      matchesSearch([p.name, p.sku, p.barcode], url.searchParams.get("search")),
    );
    rows = isActive === null
      ? rows.filter((p) => p.isActive)
      : rows.filter((p) => p.isActive === (isActive === "true"));
    if (categoryId) rows = rows.filter((p) => p.categoryId === Number(categoryId));
    if (lowStock) rows = rows.filter((p) => p.stockQty <= p.reorderLevel);

    const { items, meta } = paginate(
      rows.map(toStockItem),
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.get(`${BASE}/inventory/low-stock`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const url = new URL(request.url);
    // Only products still on sale appear in the alert list.
    const rows = db.products
      .filter((p) => p.isActive && p.stockQty <= p.reorderLevel)
      .filter((p) => matchesSearch([p.name, p.sku], url.searchParams.get("search")));
    const { items, meta } = paginate(
      rows.map(toStockItem),
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.get(`${BASE}/inventory/movements`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const type = url.searchParams.get("type");

    let rows: MockMovement[] = [...db.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (productId) rows = rows.filter((m) => m.productId === Number(productId));
    if (type) rows = rows.filter((m) => m.type === type);

    // The contract names these movementType / quantityChange.
    const enriched = rows.map((m) => {
      const product = db.products.find((p) => p.id === m.productId);
      const creator = db.users.find((u) => u.id === m.createdBy);
      return {
        id: m.id,
        productId: m.productId,
        product: product
          ? { id: product.id, sku: product.sku, name: product.name, unit: product.unit }
          : undefined,
        movementType: m.type,
        quantityChange: m.quantity,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        createdBy: m.createdBy,
        creator: creator ? { id: creator.id, fullName: creator.fullName } : undefined,
        note: null,
        createdAt: m.createdAt,
      };
    });
    const { items, meta } = paginate(
      enriched,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.post(`${BASE}/inventory/stock-counts`, guard(async ({ request }) => {
    await simulateLatency();
    const user = actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const body = (await request.json()) as {
      productId: number; countedQty: number; reason: string; expectedSystemQty: number;
    };

    const product = db.products.find((p) => p.id === body.productId);
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.");

    if (!Number.isInteger(body.countedQty) || body.countedQty < 0) {
      return fail(422, "INVALID_QUANTITY", "Số lượng đếm phải là số nguyên không âm.");
    }
    if (!body.reason?.trim()) {
      return fail(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", [
        { field: "reason", messages: ["Lý do điều chỉnh là bắt buộc."] },
      ]);
    }

    // UC-04 E2 — the stock the operator saw must still be the stock on hand.
    if (product.stockQty !== body.expectedSystemQty) {
      return fail(409, "STOCK_CONFLICT", "Tồn kho đã thay đổi kể từ khi bạn mở màn hình.", {
        productId: product.id,
        expectedSystemQty: body.expectedSystemQty,
        currentStockQty: product.stockQty,
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const systemQty = product.stockQty;
    const difference = body.countedQty - systemQty;

    product.stockQty = body.countedQty;   // BR11 — a count never changes cost price.
    product.updatedAt = nowIso;

    const count = {
      id: nextId(db.stockCounts),
      countNo: nextDocumentNumber("KK", now, nextSequence(`KK-${toStoreDateString(now)}`)),
      productId: product.id, systemQty, countedQty: body.countedQty, difference,
      reason: body.reason.trim(), createdBy: user.id, createdAt: nowIso,
    };
    db.stockCounts.push(count);

    if (difference !== 0) {
      db.movements.push({
        id: nextId(db.movements), productId: product.id, type: "ADJUSTMENT",
        quantity: difference, referenceType: "STOCK_COUNT", referenceId: count.id,
        createdBy: user.id, createdAt: nowIso,
      });
    }

    persist();
    return ok({
      stockCount: {
        ...count,
        product: { id: product.id, sku: product.sku, name: product.name, unit: product.unit },
        creator: { id: user.id, fullName: user.fullName },
      },
      product: {
        id: product.id, sku: product.sku, name: product.name, unit: product.unit,
        stockQty: product.stockQty, reorderLevel: product.reorderLevel,
      },
    }, 201);
  })),

  http.get(`${BASE}/inventory/stock-counts`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const url = new URL(request.url);
    const rows = [...db.stockCounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const enriched = rows.map((c) => {
      const product = db.products.find((p) => p.id === c.productId);
      const creator = db.users.find((u) => u.id === c.createdBy);
      return {
        ...c,
        product: product
          ? { id: product.id, sku: product.sku, name: product.name, unit: product.unit }
          : undefined,
        creator: creator ? { id: creator.id, fullName: creator.fullName } : undefined,
      };
    });
    const { items, meta } = paginate(
      enriched,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),
];
