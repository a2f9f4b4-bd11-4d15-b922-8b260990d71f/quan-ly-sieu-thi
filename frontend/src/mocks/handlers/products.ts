import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";
import type { ProductResponse, Role } from "@/lib/api/types";

/** Cashiers must never receive costPrice — the key is absent, not null. */
function view(product: ProductResponse, role: Role) {
  if (role !== "CASHIER") return product;
  const copy = { ...product } as Partial<ProductResponse>;
  delete copy.costPrice;
  return copy;
}

export const productHandlers = [
  http.get(`${BASE}/products`, guard(async ({ request }) => {
    await simulateLatency();
    const user = actingUser(request);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const search = url.searchParams.get("search");
    const categoryId = url.searchParams.get("categoryId");
    const isActive = url.searchParams.get("isActive");

    let rows = db.products.filter((p) => matchesSearch([p.name, p.sku, p.barcode], search));
    if (categoryId) rows = rows.filter((p) => p.categoryId === Number(categoryId));
    rows = isActive === null
      ? rows.filter((p) => p.isActive)
      : rows.filter((p) => p.isActive === (isActive === "true"));

    const { items, meta } = paginate(rows, page, pageSize);
    return okList(items.map((p) => view(p, user.role)), meta);
  })),

  http.get(`${BASE}/products/lookup`, guard(async ({ request }) => {
    await simulateLatency();
    const user = actingUser(request);
    const code = new URL(request.url).searchParams.get("code") ?? "";
    const product = db.products.find((p) => p.sku === code || p.barcode === code);

    if (!product) return fail(404, "PRODUCT_NOT_FOUND", `Không tìm thấy sản phẩm với mã "${code}".`);
    if (!product.isActive) return fail(422, "PRODUCT_UNAVAILABLE", `Sản phẩm "${product.name}" đã ngừng bán.`);
    return ok(view(product, user.role));
  })),

  http.get(`${BASE}/products/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    const user = actingUser(request);
    const product = db.products.find((p) => p.id === Number(params.id));
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.");
    return ok(view(product, user.role));
  })),

  http.post(`${BASE}/products`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const body = (await request.json()) as Record<string, string | number | undefined>;

    if (db.products.some((p) => p.sku === body.sku)) {
      return fail(409, "DUPLICATE_VALUE", "Mã SKU đã tồn tại.", { fields: ["sku"] });
    }
    const category = db.categories.find((c) => c.id === Number(body.categoryId));
    if (!category) return fail(422, "CATEGORY_NOT_FOUND", "Danh mục không tồn tại.");
    if (!category.isActive) return fail(422, "CATEGORY_INACTIVE", "Danh mục đã ngừng sử dụng.");

    const now = new Date().toISOString();
    const product = {
      id: nextId(db.products),
      categoryId: category.id,
      category: { id: category.id, name: category.name },
      sku: String(body.sku), barcode: body.barcode ? String(body.barcode) : null,
      name: String(body.name), unit: String(body.unit),
      salePrice: Number(body.salePrice), costPrice: Number(body.costPrice ?? 0),
      stockQty: 0, reorderLevel: Number(body.reorderLevel ?? 0),
      isActive: true, createdAt: now, updatedAt: now,
    } as unknown as ProductResponse;
    db.products.push(product);
    persist();
    return ok(product, 201);
  })),

  http.patch(`${BASE}/products/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const product = db.products.find((p) => p.id === Number(params.id));
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.");

    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(product, body, { updatedAt: new Date().toISOString() });
    if (body.categoryId) {
      const category = db.categories.find((c) => c.id === Number(body.categoryId));
      if (!category) return fail(422, "CATEGORY_NOT_FOUND", "Danh mục không tồn tại.");
      if (!category.isActive) return fail(422, "CATEGORY_INACTIVE", "Danh mục đã ngừng sử dụng.");
      product.category = { id: category.id, name: category.name };
    }
    persist();
    return ok(product);
  })),

  ...(["activate", "deactivate"] as const).map((action) =>
    http.post(`${BASE}/products/:id/${action}`, guard(async ({ request, params }) => {
      await simulateLatency();
      actingUser(request, ["ADMIN", "STOCKKEEPER"]);
      const product = db.products.find((p) => p.id === Number(params.id));
      if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.");
      product.isActive = action === "activate";
      product.updatedAt = new Date().toISOString();
      persist();
      return ok(product);
    })),
  ),
];
