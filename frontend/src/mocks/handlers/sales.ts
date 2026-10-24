import { http } from "msw";
import { db, persist, paginate, matchesSearch, nextId, nextSequence } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";
import { allocateDiscount, computePoints, maxDiscountFor, nextDocumentNumber } from "../rules";
import { toStoreDateString } from "@/lib/format/datetime";

type CartItem = { productId: number; quantity: number };
type PaymentInput = {
  method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  amount: number; tenderedAmount?: number; reference?: string;
};

export const saleHandlers = [
  http.post(`${BASE}/sales`, guard(async ({ request }) => {
    await simulateLatency();
    const user = actingUser(request, ["ADMIN", "CASHIER"]);
    const body = (await request.json()) as {
      customerId?: number; items: CartItem[]; discountAmount?: number;
      payments: PaymentInput[]; note?: string;
    };

    // Duplicate products in the cart are merged, matching the backend.
    const merged = new Map<number, number>();
    for (const item of body.items ?? []) {
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    }
    if (merged.size === 0) {
      return fail(400, "VALIDATION_ERROR", "Giỏ hàng trống.", [
        { field: "items", messages: ["Cần ít nhất một sản phẩm."] },
      ]);
    }

    const lines: Array<{ product: (typeof db.products)[number]; quantity: number }> = [];
    for (const [productId, quantity] of merged) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        return fail(422, "INVALID_QUANTITY", "Số lượng phải là số nguyên lớn hơn 0.");
      }
      const product = db.products.find((p) => p.id === productId);
      if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại.");
      if (!product.isActive) {
        return fail(422, "PRODUCT_UNAVAILABLE", `Sản phẩm "${product.name}" đã ngừng bán.`);
      }
      lines.push({ product, quantity });
    }

    // BR1 — no negative stock. Report every shortfall at once so the cart can self-correct.
    const shortfalls = lines
      .filter((l) => l.product.stockQty < l.quantity)
      .map((l) => ({
        productId: l.product.id, sku: l.product.sku, name: l.product.name,
        requested: l.quantity, available: l.product.stockQty,
      }));
    if (shortfalls.length > 0) {
      return fail(409, "INSUFFICIENT_STOCK", "Không đủ tồn kho cho một số sản phẩm.", shortfalls);
    }

    const lineSubtotals = lines.map((l) => l.product.salePrice * l.quantity);
    const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
    const discount = Math.round(body.discountAmount ?? 0);

    // BR7 — discount must stay below subtotal and within the role ceiling.
    const ceiling = maxDiscountFor(user.role, subtotal);
    if (discount < 0 || discount >= subtotal || discount > ceiling) {
      return fail(422, "INVALID_DISCOUNT", "Mức giảm giá vượt quá hạn mức cho phép.", {
        subtotal,
        maxDiscountPercent: user.role === "ADMIN" ? 100 : 10,
        maxDiscountAmount: Math.min(ceiling, Math.max(subtotal - 1, 0)),
      });
    }

    const total = subtotal - discount;
    const paid = (body.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
    if (!body.payments?.length || Math.round(paid) !== total) {
      return fail(422, "INVALID_PAYMENT", "Số tiền thanh toán phải bằng đúng số tiền phải trả.", { total, paid });
    }

    // Everything validated — commit.
    const now = new Date();
    const nowIso = now.toISOString();
    const perLineDiscount = allocateDiscount(lineSubtotals, discount);
    const saleId = nextId(db.sales);
    const sequence = nextSequence(`HD-${toStoreDateString(now)}`);

    const saleItems = lines.map((l, i) => ({
      id: i + 1, saleId, productId: l.product.id,
      skuSnapshot: l.product.sku, nameSnapshot: l.product.name,
      quantity: l.quantity, unitPrice: l.product.salePrice,
      unitCostSnapshot: l.product.costPrice ?? 0,
      discountAmount: perLineDiscount[i],
      lineTotal: lineSubtotals[i] - perLineDiscount[i],
    }));

    const payments = (body.payments ?? []).map((p, i) => ({
      id: i + 1, saleId, method: p.method, amount: p.amount,
      tenderedAmount: p.tenderedAmount ?? p.amount,
      changeAmount: Math.max(0, (p.tenderedAmount ?? p.amount) - p.amount),
      paidAt: nowIso, reference: p.reference,
    }));

    const customer = body.customerId ? db.customers.find((c) => c.id === body.customerId) : undefined;
    const pointsEarned = customer ? computePoints(total) : 0;
    if (customer) customer.loyaltyPoints += pointsEarned;

    for (const line of lines) {
      line.product.stockQty -= line.quantity;
      db.movements.push({
        id: nextId(db.movements), productId: line.product.id, type: "SALE",
        quantity: -line.quantity, referenceType: "SALE", referenceId: saleId,
        createdBy: user.id, createdAt: nowIso,
      });
    }

    const sale = {
      id: saleId,
      invoiceNo: nextDocumentNumber("HD", now, sequence),
      customerId: customer?.id ?? null, cashierId: user.id, status: "PAID" as const,
      subtotal, discountAmount: discount, total, pointsEarned,
      soldAt: nowIso, items: saleItems, payments,
    };
    db.sales.push(sale as never);
    persist();

    return ok({ ...sale, customer: customer ?? null }, 201);
  })),

  http.get(`${BASE}/sales`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const url = new URL(request.url);
    let rows = [...db.sales].sort((a, b) => b.soldAt.localeCompare(a.soldAt));

    const search = url.searchParams.get("search");
    if (search) rows = rows.filter((s) => matchesSearch([s.invoiceNo], search));
    const method = url.searchParams.get("paymentMethod");
    if (method) rows = rows.filter((s) => s.payments.some((p) => p.method === method));
    const cashierId = url.searchParams.get("cashierId");
    if (cashierId) rows = rows.filter((s) => s.cashierId === Number(cashierId));

    const enriched = rows.map((s) => {
      const customer = s.customerId ? db.customers.find((c) => c.id === s.customerId) : undefined;
      const cashier = db.users.find((u) => u.id === s.cashierId);
      return {
        id: s.id, invoiceNo: s.invoiceNo, customerId: s.customerId, cashierId: s.cashierId,
        customer: customer
          ? { id: customer.id, customerCode: customer.customerCode, fullName: customer.fullName,
              phone: customer.phone, loyaltyPoints: customer.loyaltyPoints }
          : null,
        cashier: cashier ? { id: cashier.id, fullName: cashier.fullName } : undefined,
        status: s.status, subtotal: s.subtotal, discountAmount: s.discountAmount,
        total: s.total, pointsEarned: s.pointsEarned, soldAt: s.soldAt,
        payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
      };
    });
    const { items, meta } = paginate(
      enriched,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return okList(items, meta);
  })),

  http.get(`${BASE}/sales/:id`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const sale = db.sales.find((s) => s.id === Number(params.id));
    if (!sale) return fail(404, "SALE_NOT_FOUND", "Không tìm thấy hóa đơn.");
    const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : undefined;
    return ok({ ...sale, customer: customer ?? null });
  })),

  http.get(`${BASE}/sales/:id/print`, guard(async ({ request, params }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "CASHIER"]);
    const sale = db.sales.find((s) => s.id === Number(params.id));
    if (!sale) return fail(404, "SALE_NOT_FOUND", "Không tìm thấy hóa đơn.");
    const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : undefined;
    const cashier = db.users.find((u) => u.id === sale.cashierId);

    return ok({
      store: { name: "Siêu thị Mini 09", address: "97 Man Thiện, TP. Thủ Đức, TP.HCM", phone: "02837445678" },
      invoiceNo: sale.invoiceNo, soldAt: sale.soldAt,
      cashier: cashier ? { id: cashier.id, fullName: cashier.fullName } : undefined,
      customer: customer
        ? { id: customer.id, customerCode: customer.customerCode, fullName: customer.fullName,
            phone: customer.phone, loyaltyPoints: customer.loyaltyPoints }
        : null,
      // The receipt has its own item/payment shape: sku/name, no ids.
      items: sale.items.map((i) => ({
        sku: i.skuSnapshot, name: i.nameSnapshot, quantity: i.quantity,
        unitPrice: i.unitPrice, discountAmount: i.discountAmount, lineTotal: i.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount, total: sale.total,
      payments: sale.payments.map((p) => ({
        method: p.method, amount: p.amount, tenderedAmount: p.tenderedAmount,
        changeAmount: p.changeAmount, reference: p.reference ?? null,
      })),
      pointsEarned: sale.pointsEarned,
      customerPointsBalance: customer?.loyaltyPoints ?? null,
    });
  })),
];
