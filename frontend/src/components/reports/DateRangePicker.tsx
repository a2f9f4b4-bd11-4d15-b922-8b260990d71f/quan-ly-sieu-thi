"use client";

import { daysBetween } from "@/lib/format/datetime";

export const MAX_REPORT_DAYS = 366;

/**
 * Reports require both ends, `to` is inclusive, and the span is capped at 366 days.
 * Validated here so an invalid range never becomes a 400 round trip.
 */
export function validateRange(from: string, to: string): string | null {
  if (!from || !to) return "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.";
  const span = daysBetween(from, to);
  if (span < 0) return "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";
  if (span > MAX_REPORT_DAYS) return `Khoảng thời gian tối đa là ${MAX_REPORT_DAYS} ngày.`;
  return null;
}

export function DateRangePicker({
  from, to, onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const error = validateRange(from, to);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium">Từ ngày</span>
          <input
            type="date" value={from} aria-label="Từ ngày"
            onChange={(e) => onChange({ from: e.target.value, to })}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium">Đến ngày</span>
          <input
            type="date" value={to} aria-label="Đến ngày"
            onChange={(e) => onChange({ from, to: e.target.value })}
            className="rounded-md border px-3 py-2"
          />
        </label>
      </div>
      {error && (
        <p role="alert" data-testid="range-error" className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
