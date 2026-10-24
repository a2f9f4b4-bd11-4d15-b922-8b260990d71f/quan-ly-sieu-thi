"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { DOCUMENT_SEARCH_MAX } from "@/components/data-table/searchInput";
import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useSaleList, type SaleListItem } from "@/features/sales/api";
import { toStoreDateString } from "@/lib/format/datetime";
import type { PaymentMethod } from "@/lib/api/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt", CARD: "Thẻ", TRANSFER: "Chuyển khoản", OTHER: "Khác",
};

export default function SalesPage() {
  const router = useRouter();
  const { search, setSearch, page, setPage, searchParam } = useListState(DOCUMENT_SEARCH_MAX);
  const [method, setMethod] = useState<PaymentMethod | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useSaleList({
    page, search: searchParam, paymentMethod: method,
    from: from || undefined, to: to || undefined,
  });

  const columns: Column<SaleListItem>[] = [
    { key: "invoiceNo", header: "Số hóa đơn",
      render: (s) => <span className="font-mono text-xs">{s.invoiceNo}</span> },
    { key: "soldAt", header: "Thời điểm", render: (s) => <DateTime value={s.soldAt} /> },
    { key: "customer", header: "Khách hàng", render: (s) => s.customer?.fullName ?? "Khách lẻ" },
    { key: "cashier", header: "Thu ngân", render: (s) => s.cashier?.fullName ?? "—" },
    { key: "subtotal", header: "Tạm tính", className: "text-right",
      render: (s) => <Money value={s.subtotal} /> },
    { key: "discountAmount", header: "Giảm giá", className: "text-right",
      render: (s) => <Money value={s.discountAmount} /> },
    { key: "total", header: "Phải trả", className: "text-right",
      render: (s) => <strong><Money value={s.total} /></strong> },
    { key: "payments", header: "Thanh toán",
      render: (s) => s.payments.map((p) => METHOD_LABELS[p.method]).join(", ") },
  ];

  return (
    <RequireRole capability="viewSales">
      <h1 className="mb-4 text-xl font-semibold">Hóa đơn</h1>
      <DataTable
        columns={columns}
        query={query}
        search={search}
        onSearchChange={setSearch}
        searchMaxLength={DOCUMENT_SEARCH_MAX}
        searchPlaceholder="Tìm theo số hóa đơn…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có hóa đơn nào"
        rowTestId="sale-row"
        onRowClick={(s) => router.push(`/sales/${s.id}`)}
        filters={
          <>
            <select
              aria-label="Phương thức thanh toán"
              value={method ?? ""}
              onChange={(e) => { setMethod((e.target.value || undefined) as PaymentMethod | undefined); setPage(1); }}
              className="rounded-md border px-3 py-2"
            >
              <option value="">Tất cả phương thức</option>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{METHOD_LABELS[m]}</option>
              ))}
            </select>
            <input type="date" aria-label="Từ ngày" value={from}
                   onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                   max={toStoreDateString(new Date())}
                   className="rounded-md border px-3 py-2" />
            <input type="date" aria-label="Đến ngày" value={to}
                   onChange={(e) => { setTo(e.target.value); setPage(1); }}
                   max={toStoreDateString(new Date())}
                   className="rounded-md border px-3 py-2" />
          </>
        }
      />
    </RequireRole>
  );
}
