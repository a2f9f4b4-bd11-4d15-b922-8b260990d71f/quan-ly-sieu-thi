"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Money } from "@/components/Money";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { ReportShell } from "@/components/reports/ReportShell";
import { validateRange } from "@/components/reports/DateRangePicker";
import { useRevenueReport } from "@/features/reports/api";
import { toStoreDateString } from "@/lib/format/datetime";
import { formatVnd } from "@/lib/format/money";

export default function RevenueReportPage() {
  const today = toStoreDateString(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");

  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "viewRevenueReports") : false;
  const valid = validateRange(range.from, range.to) === null && mayView;
  const query = useRevenueReport({ ...range, groupBy, enabled: valid });
  const rows = query.data?.rows ?? [];

  return (
    <RequireRole capability="viewRevenueReports">
      <ReportShell
        title="Báo cáo doanh thu"
        from={range.from} to={range.to} onRangeChange={setRange}
        isLoading={query.isLoading} isEmpty={rows.length === 0}
        controls={
          <label className="space-y-1">
            <span className="block text-sm font-medium">Nhóm theo</span>
            <select aria-label="Nhóm theo" value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as "day" | "month")}
                    className="rounded-md border px-3 py-2">
              <option value="day">Ngày</option>
              <option value="month">Tháng</option>
            </select>
          </label>
        }
      >
        <div className="mb-4 h-64 rounded-lg border bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(v) => String(v / 1000)} />
              <Tooltip formatter={(v) => formatVnd(Number(v))} />
              <Bar dataKey="netRevenue" fill="#0f172a" name="Doanh thu thuần" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Kỳ</th>
                <th className="px-3 py-2 text-right">Số hóa đơn</th>
                <th className="px-3 py-2 text-right">Tiền hàng</th>
                <th className="px-3 py-2 text-right">Giảm giá</th>
                <th className="px-3 py-2 text-right">Doanh thu thuần</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period} data-testid="revenue-row" className="border-t">
                  <td className="px-3 py-2">{r.period}</td>
                  <td className="px-3 py-2 text-right">{r.invoiceCount}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.grossSales} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.discountAmount} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.netRevenue} /></td>
                </tr>
              ))}
            </tbody>
            {query.data && (
              <tfoot className="border-t bg-slate-50 font-medium">
                <tr>
                  <td className="px-3 py-2">Tổng</td>
                  <td className="px-3 py-2 text-right" data-testid="total-invoices">
                    {query.data.totals.invoiceCount}
                  </td>
                  <td className="px-3 py-2 text-right"><Money value={query.data.totals.grossSales} /></td>
                  <td className="px-3 py-2 text-right"><Money value={query.data.totals.discountAmount} /></td>
                  <td className="px-3 py-2 text-right" data-testid="total-revenue">
                    <Money value={query.data.totals.netRevenue} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ReportShell>
    </RequireRole>
  );
}
