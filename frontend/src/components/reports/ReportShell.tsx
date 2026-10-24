"use client";

import Link from "next/link";
import { DateRangePicker, validateRange } from "./DateRangePicker";

/** Shared chrome for the four reports: title, range picker, and empty/error states. */
export function ReportShell({
  title, from, to, onRangeChange, isLoading, isEmpty, children, controls,
}: {
  title: string;
  from: string;
  to: string;
  onRangeChange: (next: { from: string; to: string }) => void;
  isLoading: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
  controls?: React.ReactNode;
}) {
  const rangeError = validateRange(from, to);

  return (
    <>
      <Link href="/reports" className="text-sm text-slate-500 underline">← Danh sách báo cáo</Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">{title}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <DateRangePicker from={from} to={to} onChange={onRangeChange} />
        {controls}
      </div>

      {rangeError ? null : isLoading ? (
        <p className="text-sm text-slate-500">Đang tải báo cáo…</p>
      ) : isEmpty ? (
        /* An empty result is a valid answer, not an error (UC-05 E3). */
        <p data-testid="report-empty" className="rounded-lg border bg-white py-16 text-center text-slate-500">
          Không có dữ liệu trong khoảng thời gian đã chọn
        </p>
      ) : (
        children
      )}
    </>
  );
}
