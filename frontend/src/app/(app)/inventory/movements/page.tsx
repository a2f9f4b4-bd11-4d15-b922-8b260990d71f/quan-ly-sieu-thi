"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { DateTime } from "@/components/DateTime";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useMovementList } from "@/features/inventory/api";
import type { MovementResponse, MovementType } from "@/lib/api/types";

const TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE: "Nhập hàng",
  SALE: "Bán hàng",
  ADJUSTMENT: "Điều chỉnh",
  REVERSAL: "Hoàn kho",
};

const REFERENCE_LABELS: Record<string, string> = {
  PURCHASE: "Phiếu nhập",
  SALE: "Hóa đơn",
  STOCK_COUNT: "Kiểm kê",
};

export default function MovementsPage() {
  const { page, setPage, search, setSearch } = useListState();
  const [type, setType] = useState<MovementType | undefined>();
  const { user } = useAuth();
  const mayView = user ? can(user.role, "viewMovements") : false;
  const query = useMovementList({ page, type }, { enabled: mayView });

  const columns: Column<MovementResponse & { id: number }>[] = [
    { key: "createdAt", header: "Thời điểm", render: (m) => <DateTime value={m.createdAt} /> },
    { key: "product", header: "Sản phẩm", render: (m) => m.product?.name ?? "—" },
    { key: "movementType", header: "Loại", render: (m) => TYPE_LABELS[m.movementType] },
    { key: "quantityChange", header: "Số lượng", className: "text-right",
      render: (m) => (
        <span className={m.quantityChange < 0 ? "text-red-600" : "text-green-700"}>
          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
        </span>
      ) },
    { key: "reference", header: "Chứng từ",
      render: (m) => `${REFERENCE_LABELS[m.referenceType] ?? m.referenceType} #${m.referenceId}` },
    { key: "creator", header: "Người thực hiện", render: (m) => m.creator?.fullName ?? "—" },
  ];

  return (
    <RequireRole capability="viewMovements">
      <h1 className="mb-4 text-xl font-semibold">Biến động kho</h1>
      <DataTable
        columns={columns}
        query={query as never}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm kiếm…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có biến động kho nào"
        rowTestId="movement-row"
        filters={
          <select
            aria-label="Loại biến động"
            value={type ?? ""}
            onChange={(e) => { setType((e.target.value || undefined) as MovementType | undefined); setPage(1); }}
            className="rounded-md border px-3 py-2"
          >
            <option value="">Tất cả loại</option>
            {(Object.keys(TYPE_LABELS) as MovementType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        }
      />
    </RequireRole>
  );
}
