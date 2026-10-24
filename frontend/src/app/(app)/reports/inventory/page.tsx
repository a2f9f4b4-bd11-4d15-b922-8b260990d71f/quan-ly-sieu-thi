"use client";

import { useState } from "react";
import { Money } from "@/components/Money";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { ReportShell } from "@/components/reports/ReportShell";
import { validateRange } from "@/components/reports/DateRangePicker";
import { useInventoryReport } from "@/features/reports/api";
import { useCategoryList } from "@/features/categories/api";
import { toStoreDateString } from "@/lib/format/datetime";

export default function InventoryReportPage() {
  const today = toStoreDateString(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const [categoryId, setCategoryId] = useState<number | undefined>();

  const valid = validateRange(range.from, range.to) === null;
  const query = useInventoryReport({ ...range, categoryId, enabled: valid });
  const categories = useCategoryList({ page: 1, pageSize: 100 });
  const rows = query.data?.products.items ?? [];

  return (
    <RequireRole capability="viewInventoryReport">
      <ReportShell
        title="Báo cáo tồn kho"
        from={range.from} to={range.to} onRangeChange={setRange}
        isLoading={query.isLoading} isEmpty={rows.length === 0}
        controls={
          <label className="space-y-1">
            <span className="block text-sm font-medium">Danh mục</span>
            <select aria-label="Danh mục" value={categoryId ?? ""}
                    onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                    className="rounded-md border px-3 py-2">
              <option value="">Tất cả danh mục</option>
              {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        }
      >
        {query.data && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-slate-500">Số sản phẩm</p>
              <p className="text-lg font-semibold">{query.data.summary.productCount}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-slate-500">Tổng giá trị tồn</p>
              <p className="text-lg font-semibold" data-testid="total-stock-value">
                <Money value={query.data.summary.totalStockValue} />
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-slate-500">Mặt hàng sắp hết</p>
              <p className="text-lg font-semibold">{query.data.summary.lowStockCount}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2 text-right">Tồn</th>
                <th className="px-3 py-2 text-right">Giá vốn</th>
                <th className="px-3 py-2 text-right">Giá trị tồn</th>
                <th className="px-3 py-2 text-right">Nhập</th>
                <th className="px-3 py-2 text-right">Xuất</th>
                <th className="px-3 py-2 text-right">Điều chỉnh</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} data-testid="inventory-report-row" className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.stockQty}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.costPrice} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.stockValue} /></td>
                  <td className="px-3 py-2 text-right">{r.qtyIn}</td>
                  <td className="px-3 py-2 text-right">{r.qtyOut}</td>
                  <td className="px-3 py-2 text-right">{r.qtyAdjusted}</td>
                  <td className="px-3 py-2">{r.isLowStock && <StatusBadge status="LOW_STOCK" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportShell>
    </RequireRole>
  );
}
