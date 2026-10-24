"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { StatusBadge } from "@/components/StatusBadge";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useSaleDetail } from "@/features/sales/api";
import { DetailState } from "@/components/DetailState";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const saleId = Number(id);
  const { user } = useAuth();
  const { data: sale, isLoading, error } = useSaleDetail(saleId);
  const [printing, setPrinting] = useState(false);

  const showCost = user ? can(user.role, "viewCostPrice") : false;

  if (!sale) {
    // RequireRole wraps the state so a forbidden URL renders the gate too.
    return (
      <RequireRole capability="viewSales">
        <DetailState isLoading={isLoading} error={error} loadingLabel="Đang tải hóa đơn…" />
      </RequireRole>
    );
  }

  if (printing) {
    return <ReceiptDialog saleId={saleId} onClose={() => setPrinting(false)} />;
  }

  return (
    <RequireRole capability="viewSales">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/sales" className="text-sm text-slate-500 underline">← Danh sách hóa đơn</Link>
          <h1 className="mt-1 text-xl font-semibold">{sale.invoiceNo}</h1>
        </div>
        <button onClick={() => setPrinting(true)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          In lại
        </button>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border bg-white p-4 text-sm sm:grid-cols-2">
        <p>Thời điểm: <DateTime value={sale.soldAt} /></p>
        <p>Trạng thái: <StatusBadge status={sale.status} /></p>
        <p>Khách hàng: {sale.customer?.fullName ?? "Khách lẻ"}</p>
        <p>Điểm tích lũy: {sale.pointsEarned}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Mặt hàng</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2 text-right">Đơn giá</th>
              {/*
                The API still returns unitCostSnapshot to CASHIER (a known backend gap).
                Never render it for a cashier regardless of what the payload contains.
              */}
              {showCost && <th className="px-3 py-2 text-right">Giá vốn</th>}
              <th className="px-3 py-2 text-right">Giảm giá</th>
              <th className="px-3 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{item.skuSnapshot}</td>
                <td className="px-3 py-2">{item.nameSnapshot}</td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right"><Money value={item.unitPrice} /></td>
                {showCost && (
                  <td className="px-3 py-2 text-right" data-testid="cost-cell">
                    <Money value={item.unitCostSnapshot} />
                  </td>
                )}
                <td className="px-3 py-2 text-right"><Money value={item.discountAmount} /></td>
                <td className="px-3 py-2 text-right"><Money value={item.lineTotal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 rounded-lg border bg-white p-4 text-sm">
        <p className="flex justify-between"><span>Tạm tính</span><Money value={sale.subtotal} /></p>
        <p className="flex justify-between"><span>Giảm giá</span><Money value={sale.discountAmount} /></p>
        <p className="flex justify-between text-base font-semibold">
          <span>Phải trả</span><Money value={sale.total} />
        </p>
        {sale.payments.map((p) => (
          <p key={p.id} className="flex justify-between text-slate-600">
            <span>{p.method}{p.reference ? ` — ${p.reference}` : ""}</span>
            <Money value={p.amount} />
          </p>
        ))}
      </div>
    </RequireRole>
  );
}
