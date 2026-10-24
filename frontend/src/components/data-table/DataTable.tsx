"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { AppError } from "@/lib/api/errors";
import { normalizeSearch, SEARCH_MAX } from "./searchInput";
import type { Paged } from "@/lib/api/types";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  query: UseQueryResult<Paged<T>, unknown>;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchMaxLength?: number;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  page: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowTestId?: string;
};

export function DataTable<T extends { id: number }>({
  columns, query, search, onSearchChange, searchPlaceholder = "Tìm kiếm…",
  searchMaxLength = SEARCH_MAX, filters, actions, page, onPageChange,
  emptyMessage = "Không có dữ liệu", onRowClick, rowTestId,
}: Props<T>) {
  const { data, isLoading, error } = query;

  // Role gating in the UI is a convenience; this is what a real 403 looks like.
  if (error instanceof AppError && error.code === "FORBIDDEN") {
    return (
      <div className="rounded-lg border bg-white py-20 text-center" data-testid="forbidden">
        <h2 className="font-semibold">Không có quyền truy cập</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tài khoản của bạn không được phép xem danh sách này.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white py-20 text-center" data-testid="list-error">
        <h2 className="font-semibold">Không tải được dữ liệu</h2>
        <p className="mt-1 text-sm text-slate-500">
          {error instanceof AppError ? error.message : "Vui lòng thử lại."}
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Tìm kiếm"
          placeholder={searchPlaceholder}
          maxLength={searchMaxLength}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 rounded-md border px-3 py-2"
        />
        {filters}
        <div className="ml-auto">{actions}</div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.className ?? ""}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!isLoading &&
              data?.items.map((row) => (
                <tr
                  key={row.id}
                  data-testid={rowTestId}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-t ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.className ?? ""}`}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.meta.total > data.meta.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Trang {data.meta.page} / {totalPages} — {data.meta.total} bản ghi
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1} onClick={() => onPageChange(page - 1)}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >Trước</button>
            <button
              disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
              className="rounded-md border px-3 py-1 disabled:opacity-40"
            >Sau</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { normalizeSearch };
