"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Money } from "@/components/Money";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { ReportShell } from "@/components/reports/ReportShell";
import { validateRange } from "@/components/reports/DateRangePicker";
import { useGrossProfitReport } from "@/features/reports/api";
import { toStoreDateString } from "@/lib/format/datetime";
import { formatVnd } from "@/lib/format/money";

export default function GrossProfitReportPage() {
  const today = toStoreDateString(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");

  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "viewRevenueReports") : false;
  const valid = validateRange(range.from, range.to) === null && mayView;
  const query = useGrossProfitReport({ ...range, groupBy, enabled: valid });
  const rows = query.data?.rows ?? [];

  return (
    <RequireRole capability="viewRevenueReports">
      <ReportShell
        title="Lợi nhuận gộp"
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
        <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Lợi nhuận gộp ước tính: doanh thu sau giảm giá trừ giá vốn đã chụp lúc bán.
          Chưa tính chi phí vận hành và thuế.
        </p>

        <div className="mb-4 h-64 rounded-lg border bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(v) => String(v / 1000)} />
              <Tooltip formatter={(v) => formatVnd(Number(v))} />
              <Line type="monotone" dataKey="grossProfit" stroke="#0f172a" name="Lợi nhuận gộp" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Kỳ</th>
                <th className="px-3 py-2 text-right">Số hóa đơn</th>
                <th className="px-3 py-2 text-right">Doanh thu</th>
                <th className="px-3 py-2 text-right">Giá vốn</th>
                <th className="px-3 py-2 text-right">Lợi nhuận gộp</th>
                <th className="px-3 py-2 text-right">Tỷ suất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period} data-testid="profit-row" className="border-t">
                  <td className="px-3 py-2">{r.period}</td>
                  <td className="px-3 py-2 text-right">{r.invoiceCount}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.revenue} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.cogs} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.grossProfit} /></td>
                  <td className="px-3 py-2 text-right">{r.marginPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportShell>
    </RequireRole>
  );
}
