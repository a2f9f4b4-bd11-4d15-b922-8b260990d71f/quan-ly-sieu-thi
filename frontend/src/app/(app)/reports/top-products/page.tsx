"use client";

import { useState } from "react";
import { Money } from "@/components/Money";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { ReportShell } from "@/components/reports/ReportShell";
import { validateRange } from "@/components/reports/DateRangePicker";
import { useTopProductsReport } from "@/features/reports/api";
import { toStoreDateString } from "@/lib/format/datetime";

export default function TopProductsReportPage() {
  const today = toStoreDateString(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const [sortBy, setSortBy] = useState<"quantity" | "revenue">("quantity");
  const [limit, setLimit] = useState(10);

  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "viewRevenueReports") : false;
  const valid = validateRange(range.from, range.to) === null && mayView;
  const query = useTopProductsReport({ ...range, sortBy, limit, enabled: valid });
  const rows = query.data?.rows ?? [];

  return (
    <RequireRole capability="viewRevenueReports">
      <ReportShell
        title="Sản phẩm bán chạy"
        from={range.from} to={range.to} onRangeChange={setRange}
        isLoading={query.isLoading} isEmpty={rows.length === 0}
        controls={
          <>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Sắp xếp theo</span>
              <select aria-label="Sắp xếp theo" value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "quantity" | "revenue")}
                      className="rounded-md border px-3 py-2">
                <option value="quantity">Số lượng</option>
                <option value="revenue">Doanh thu</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium">Số dòng</span>
              <select aria-label="Số dòng" value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="rounded-md border px-3 py-2">
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        }
      >
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2 text-right">Số lượng bán</th>
                <th className="px-3 py-2 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} data-testid="top-product-row" className="border-t">
                  <td className="px-3 py-2">{r.rank}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.quantitySold}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.revenue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportShell>
    </RequireRole>
  );
}
