import { http } from "msw";
import { db, paginate, matchesSearch } from "../db";
import { BASE, ok, okList, fail, simulateLatency, actingUser, guard } from "./_shared";
import { toStoreDateString } from "@/lib/format/datetime";

const MAX_DAYS = 366;

/** Mirrors the client-side guard so behaviour is identical after integration. */
function readRange(url: URL): { from: string; to: string } | Response {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return fail(400, "INVALID_DATE_RANGE", "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
  }
  const MS = 86_400_000;
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS) + 1;
  if (span < 0) return fail(400, "INVALID_DATE_RANGE", "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
  if (span > MAX_DAYS) return fail(400, "INVALID_DATE_RANGE", `Khoảng thời gian tối đa là ${MAX_DAYS} ngày.`);
  return { from, to };
}

function inRange(iso: string, from: string, to: string) {
  const day = toStoreDateString(new Date(iso));
  return day >= from && day <= to;
}

function periodOf(iso: string, groupBy: string) {
  const day = toStoreDateString(new Date(iso));
  return groupBy === "month" ? day.slice(0, 7) : day;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const reportHandlers = [
  http.get(`${BASE}/reports/revenue`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const url = new URL(request.url);
    const range = readRange(url);
    if (range instanceof Response) return range;
    const groupBy = url.searchParams.get("groupBy") ?? "day";

    const sales = db.sales.filter((s) => s.status === "PAID" && inRange(s.soldAt, range.from, range.to));
    const buckets = new Map<string, { invoiceCount: number; grossSales: number; discountAmount: number; netRevenue: number }>();
    for (const sale of sales) {
      const key = periodOf(sale.soldAt, groupBy);
      const row = buckets.get(key) ?? { invoiceCount: 0, grossSales: 0, discountAmount: 0, netRevenue: 0 };
      row.invoiceCount += 1;
      row.grossSales += sale.subtotal;
      row.discountAmount += sale.discountAmount;
      row.netRevenue += sale.total;
      buckets.set(key, row);
    }

    const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({ period, ...v }));
    const totals = rows.reduce(
      (acc, r) => ({
        invoiceCount: acc.invoiceCount + r.invoiceCount,
        grossSales: acc.grossSales + r.grossSales,
        discountAmount: acc.discountAmount + r.discountAmount,
        netRevenue: acc.netRevenue + r.netRevenue,
      }),
      { invoiceCount: 0, grossSales: 0, discountAmount: 0, netRevenue: 0 },
    );

    return ok({ from: range.from, to: range.to, generatedAt: new Date().toISOString(), groupBy, rows, totals });
  })),

  http.get(`${BASE}/reports/top-products`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const url = new URL(request.url);
    const range = readRange(url);
    if (range instanceof Response) return range;
    const sortBy = url.searchParams.get("sortBy") ?? "quantity";
    const limit = Number(url.searchParams.get("limit") ?? 10);

    const totals = new Map<number, { sku: string; name: string; quantitySold: number; revenue: number }>();
    for (const sale of db.sales) {
      if (sale.status !== "PAID" || !inRange(sale.soldAt, range.from, range.to)) continue;
      for (const item of sale.items) {
        const row = totals.get(item.productId)
          ?? { sku: item.skuSnapshot, name: item.nameSnapshot, quantitySold: 0, revenue: 0 };
        row.quantitySold += item.quantity;
        row.revenue += item.lineTotal;
        totals.set(item.productId, row);
      }
    }

    const rows = [...totals.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => (sortBy === "revenue" ? b.revenue - a.revenue : b.quantitySold - a.quantitySold))
      .slice(0, limit)
      .map((r, i) => ({ rank: i + 1, ...r }));

    return ok({ from: range.from, to: range.to, generatedAt: new Date().toISOString(), sortBy, limit, rows });
  })),

  http.get(`${BASE}/reports/gross-profit`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN"]);
    const url = new URL(request.url);
    const range = readRange(url);
    if (range instanceof Response) return range;
    const groupBy = url.searchParams.get("groupBy") ?? "day";

    const buckets = new Map<string, { invoiceCount: number; revenue: number; cogs: number }>();
    for (const sale of db.sales) {
      if (sale.status !== "PAID" || !inRange(sale.soldAt, range.from, range.to)) continue;
      const key = periodOf(sale.soldAt, groupBy);
      const row = buckets.get(key) ?? { invoiceCount: 0, revenue: 0, cogs: 0 };
      row.invoiceCount += 1;
      for (const item of sale.items) {
        row.revenue += item.lineTotal;
        row.cogs += item.unitCostSnapshot * item.quantity;
      }
      buckets.set(key, row);
    }

    const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, v]) => {
      const grossProfit = v.revenue - v.cogs;
      return {
        period, invoiceCount: v.invoiceCount, revenue: v.revenue, cogs: v.cogs, grossProfit,
        // margin is 0 when revenue is 0, never NaN
        marginPercent: v.revenue === 0 ? 0 : round2((grossProfit / v.revenue) * 100),
      };
    });

    const agg = rows.reduce(
      (a, r) => ({
        invoiceCount: a.invoiceCount + r.invoiceCount,
        revenue: a.revenue + r.revenue,
        cogs: a.cogs + r.cogs,
      }),
      { invoiceCount: 0, revenue: 0, cogs: 0 },
    );
    const totals = {
      ...agg,
      grossProfit: agg.revenue - agg.cogs,
      marginPercent: agg.revenue === 0 ? 0 : round2(((agg.revenue - agg.cogs) / agg.revenue) * 100),
    };

    return ok({ from: range.from, to: range.to, generatedAt: new Date().toISOString(), groupBy, rows, totals });
  })),

  http.get(`${BASE}/reports/inventory`, guard(async ({ request }) => {
    await simulateLatency();
    actingUser(request, ["ADMIN", "STOCKKEEPER"]);
    const url = new URL(request.url);
    const range = readRange(url);
    if (range instanceof Response) return range;
    const categoryId = url.searchParams.get("categoryId");
    const isActive = url.searchParams.get("isActive");

    let products = db.products.filter((p) =>
      matchesSearch([p.name, p.sku], url.searchParams.get("search")),
    );
    if (categoryId) products = products.filter((p) => p.categoryId === Number(categoryId));
    if (isActive !== null) products = products.filter((p) => p.isActive === (isActive === "true"));

    const rows = products.map((p) => {
      const moves = db.movements.filter(
        (m) => m.productId === p.id && inRange(m.createdAt, range.from, range.to),
      );
      const qtyIn = moves.filter((m) => m.type === "PURCHASE").reduce((s, m) => s + m.quantity, 0);
      const qtyOut = moves.filter((m) => m.type === "SALE").reduce((s, m) => s + Math.abs(m.quantity), 0);
      const qtyAdjusted = moves.filter((m) => m.type === "ADJUSTMENT").reduce((s, m) => s + m.quantity, 0);
      const costPrice = p.costPrice ?? 0;
      return {
        productId: p.id, sku: p.sku, name: p.name, unit: p.unit,
        stockQty: p.stockQty, costPrice, stockValue: round2(p.stockQty * costPrice),
        reorderLevel: p.reorderLevel, isLowStock: p.stockQty <= p.reorderLevel,
        isActive: p.isActive, qtyIn, qtyOut, qtyAdjusted,
      };
    });

    const summary = {
      productCount: rows.length,
      totalStockValue: round2(rows.reduce((s, r) => s + r.stockValue, 0)),
      lowStockCount: rows.filter((r) => r.isLowStock).length,
      movements: {
        qtyIn: rows.reduce((s, r) => s + r.qtyIn, 0),
        qtyOut: rows.reduce((s, r) => s + r.qtyOut, 0),
        qtyAdjusted: rows.reduce((s, r) => s + r.qtyAdjusted, 0),
      },
    };

    const { items, meta } = paginate(
      rows,
      Number(url.searchParams.get("page") ?? 1),
      Number(url.searchParams.get("pageSize") ?? 20),
    );
    return ok({
      from: range.from, to: range.to, generatedAt: new Date().toISOString(),
      summary, products: { items, meta },
    });
  })),
];
