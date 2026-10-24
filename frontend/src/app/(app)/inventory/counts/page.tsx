"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { DateTime } from "@/components/DateTime";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  useStockList, useStockCountList, useCreateStockCount,
} from "@/features/inventory/api";
import { AppError, isCode } from "@/lib/api/errors";
import type { StockCountResponse } from "@/lib/api/types";

type Selected = { productId: number; name: string; unit: string; systemQty: number };

export default function StockCountsPage() {
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const { user } = useAuth();
  const mayView = user ? can(user.role, "countStock") : false;
  const stock = useStockList({ page: 1, pageSize: 50, search: searchParam }, { enabled: mayView });
  const history = useStockCountList({ page }, { enabled: mayView });
  const createCount = useCreateStockCount();

  const [selected, setSelected] = useState<Selected | null>(null);
  const [countedQty, setCountedQty] = useState(0);
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState<{ expectedSystemQty: number; currentStockQty: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const difference = selected ? countedQty - selected.systemQty : 0;

  function submit() {
    if (!selected) return;
    setConflict(null);
    setFormError(null);

    createCount.mutate(
      {
        productId: selected.productId,
        countedQty,
        reason,
        // The number the operator actually saw — never re-read at submit time,
        // because detecting that it moved is the entire point.
        expectedSystemQty: selected.systemQty,
      },
      {
        onSuccess: () => { setSelected(null); setCountedQty(0); setReason(""); },
        onError: (error) => {
          if (isCode(error, "STOCK_CONFLICT")) {
            setConflict(error.details as { expectedSystemQty: number; currentStockQty: number });
            return;
          }
          setFormError(error instanceof AppError ? error.message : "Không ghi nhận được kiểm kê.");
        },
      },
    );
  }

  const columns: Column<StockCountResponse>[] = [
    { key: "countNo", header: "Số phiếu",
      render: (c) => <span className="font-mono text-xs">{c.countNo}</span> },
    { key: "createdAt", header: "Thời điểm", render: (c) => <DateTime value={c.createdAt} /> },
    { key: "product", header: "Sản phẩm", render: (c) => c.product?.name ?? "—" },
    { key: "systemQty", header: "Tồn hệ thống", className: "text-right", render: (c) => c.systemQty },
    { key: "countedQty", header: "Thực đếm", className: "text-right", render: (c) => c.countedQty },
    { key: "difference", header: "Chênh lệch", className: "text-right",
      render: (c) => (
        <span className={c.difference < 0 ? "text-red-600" : c.difference > 0 ? "text-green-700" : ""}>
          {c.difference > 0 ? `+${c.difference}` : c.difference}
        </span>
      ) },
    { key: "reason", header: "Lý do", render: (c) => c.reason },
    { key: "creator", header: "Người thực hiện", render: (c) => c.creator?.fullName ?? "—" },
  ];

  return (
    <RequireRole capability="countStock">
      <h1 className="mb-4 text-xl font-semibold">Kiểm kê</h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Chọn sản phẩm</h2>
          <input
            aria-label="Tìm sản phẩm"
            placeholder="Tìm theo tên hoặc SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 w-full rounded-md border px-3 py-2"
          />
          <ul className="max-h-64 overflow-y-auto text-sm">
            {stock.data?.items.map((item) => (
              <li key={item.productId}>
                <button
                  onClick={() => {
                    setSelected({
                      productId: item.productId, name: item.name,
                      unit: item.unit, systemQty: item.stockQty,
                    });
                    setCountedQty(item.stockQty);
                    setConflict(null);
                    setFormError(null);
                  }}
                  className={`w-full rounded px-2 py-1.5 text-left hover:bg-slate-50 ${
                    selected?.productId === item.productId ? "bg-slate-100 font-medium" : ""
                  }`}
                >
                  {item.name} — tồn {item.stockQty}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">Chọn một sản phẩm để bắt đầu kiểm kê.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium" data-testid="count-product">{selected.name}</p>
              <p className="text-sm">
                Tồn hệ thống: <strong data-testid="system-qty">{selected.systemQty}</strong> {selected.unit}
              </p>

              <label className="block space-y-1">
                <span className="text-sm font-medium">Số lượng thực đếm</span>
                <input
                  type="number" min={0} step={1} value={countedQty}
                  aria-label="Số lượng thực đếm"
                  onChange={(e) => setCountedQty(Number(e.target.value))}
                  className="w-40 rounded-md border px-3 py-2"
                />
              </label>

              <p className="text-sm" data-testid="count-difference">
                Chênh lệch:{" "}
                <strong className={difference < 0 ? "text-red-600" : difference > 0 ? "text-green-700" : ""}>
                  {difference > 0 ? `+${difference}` : difference}
                </strong>
              </p>

              <label className="block space-y-1">
                <span className="text-sm font-medium">Lý do điều chỉnh</span>
                <textarea
                  value={reason} aria-label="Lý do điều chỉnh"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Hàng hỏng, kiểm kê định kỳ…"
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>

              {conflict && (
                <div role="alert" data-testid="stock-conflict"
                     className="rounded-md border border-amber-300 bg-amber-50 p-4">
                  <p className="font-medium">Tồn kho đã thay đổi</p>
                  <p className="mt-1 text-sm">
                    Bạn thấy <strong>{conflict.expectedSystemQty}</strong>, hệ thống hiện có{" "}
                    <strong>{conflict.currentStockQty}</strong>. Có thể vừa có giao dịch bán hoặc nhập hàng.
                  </p>
                  <button
                    onClick={() => {
                      setSelected({ ...selected, systemQty: conflict.currentStockQty });
                      setConflict(null);
                    }}
                    className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white"
                  >
                    Tải lại số tồn và đếm lại
                  </button>
                </div>
              )}

              {formError && (
                <p role="alert" data-testid="form-error" className="text-sm text-red-600">{formError}</p>
              )}

              <button
                onClick={submit}
                disabled={createCount.isPending || !reason.trim()}
                className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {createCount.isPending ? "Đang ghi nhận…" : "Ghi nhận kiểm kê"}
              </button>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Lịch sử kiểm kê</h2>
      <DataTable
        columns={columns}
        query={history}
        search=""
        onSearchChange={() => {}}
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có lần kiểm kê nào"
        rowTestId="count-row"
      />
    </RequireRole>
  );
}
