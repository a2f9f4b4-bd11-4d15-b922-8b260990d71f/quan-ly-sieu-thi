import { http } from "msw";
import { db, paginate, matchesSearch, type MockMovement } from "../db";
import { BASE, okList, simulateLatency, actingUser, guard } from "./_shared";
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
];
