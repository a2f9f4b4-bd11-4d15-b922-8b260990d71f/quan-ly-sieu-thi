"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { DOCUMENT_SEARCH_MAX } from "@/components/data-table/searchInput";
import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { usePurchaseList, type PurchaseListItem } from "@/features/purchases/api";
import type { PurchaseStatus } from "@/lib/api/types";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Nháp", RECEIVED: "Đã nhận", CANCELLED: "Đã hủy",
};

export default function PurchasesPage() {
  const router = useRouter();
  const { search, setSearch, page, setPage, searchParam } = useListState(DOCUMENT_SEARCH_MAX);
  const [status, setStatus] = useState<PurchaseStatus | undefined>();
  const query = usePurchaseList({ page, search: searchParam, status });

  const columns: Column<PurchaseListItem>[] = [
    { key: "purchaseNo", header: "Số phiếu",
      render: (p) => <span className="font-mono text-xs">{p.purchaseNo}</span> },
    { key: "createdAt", header: "Ngày lập", render: (p) => <DateTime value={p.createdAt} /> },
    { key: "supplier", header: "Nhà cung cấp", render: (p) => p.supplier?.name ?? "—" },
    { key: "creator", header: "Người lập", render: (p) => p.creator?.fullName ?? "—" },
    { key: "total", header: "Tổng tiền", className: "text-right", render: (p) => <Money value={p.total} /> },
    { key: "status", header: "Trạng thái", render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <RequireRole capability="managePurchases">
      <h1 className="mb-4 text-xl font-semibold">Phiếu nhập</h1>
      <DataTable
        columns={columns}
        query={query}
        search={search}
        onSearchChange={setSearch}
        searchMaxLength={DOCUMENT_SEARCH_MAX}
        searchPlaceholder="Tìm theo số phiếu…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có phiếu nhập nào"
        rowTestId="purchase-row"
        onRowClick={(p) => router.push(`/purchases/${p.id}`)}
        filters={
          <select
            aria-label="Trạng thái"
            value={status ?? ""}
            onChange={(e) => { setStatus((e.target.value || undefined) as PurchaseStatus | undefined); setPage(1); }}
            className="rounded-md border px-3 py-2"
          >
            <option value="">Tất cả trạng thái</option>
            {(Object.keys(STATUS_LABELS) as PurchaseStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        }
        actions={
          <Link href="/purchases/new"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Tạo phiếu nhập
          </Link>
        }
      />
    </RequireRole>
  );
}
