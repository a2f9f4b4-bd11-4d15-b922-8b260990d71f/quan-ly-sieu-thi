"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useStockList, useLowStockList } from "@/features/inventory/api";
import type { StockItemResponse } from "@/lib/api/types";

export default function InventoryPage() {
  const { user } = useAuth();
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const [tab, setTab] = useState<"all" | "low">("all");

  const canSeeAlerts = user ? can(user.role, "viewLowStock") : false;
  const allQuery = useStockList({ page, search: searchParam });
  // Gate the QUERY, not just the tab: viewLowStock is admin/stockkeeper only.
  const lowQuery = useLowStockList({ page, search: searchParam }, { enabled: canSeeAlerts });
  const query = tab === "low" && canSeeAlerts ? lowQuery : allQuery;

  const columns: Column<StockItemResponse & { id: number }>[] = [
    { key: "sku", header: "SKU", render: (s) => <span className="font-mono text-xs">{s.sku}</span> },
    { key: "name", header: "Tên sản phẩm", render: (s) => s.name },
    { key: "unit", header: "ĐVT", render: (s) => s.unit },
    { key: "categoryName", header: "Danh mục", render: (s) => s.categoryName || "—" },
    { key: "stockQty", header: "Tồn", className: "text-right",
      render: (s) => (
        <span className={s.isLowStock ? "font-semibold text-red-600" : ""}>{s.stockQty}</span>
      ) },
    { key: "reorderLevel", header: "Ngưỡng", className: "text-right", render: (s) => s.reorderLevel },
    { key: "flag", header: "", render: (s) => (s.isLowStock ? <StatusBadge status="LOW_STOCK" /> : null) },
  ];

  return (
    <RequireRole capability="viewStock">
      <h1 className="mb-4 text-xl font-semibold">Tồn kho</h1>

      {canSeeAlerts && (
        <div className="mb-4 flex gap-2">
          {([["all", "Tất cả"], ["low", "Sắp hết hàng"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === key ? "bg-slate-900 text-white" : "border hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <DataTable
        /* StockItemResponse keys on productId; DataTable needs a stable `id`. */
        columns={columns}
        query={{
          ...query,
          data: query.data
            ? { ...query.data, items: query.data.items.map((i) => ({ ...i, id: i.productId })) }
            : undefined,
        } as never}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, SKU hoặc mã vạch…"
        page={page}
        onPageChange={setPage}
        emptyMessage={tab === "low" ? "Không có mặt hàng nào sắp hết" : "Không tìm thấy sản phẩm nào"}
        rowTestId="stock-row"
      />
    </RequireRole>
  );
}
