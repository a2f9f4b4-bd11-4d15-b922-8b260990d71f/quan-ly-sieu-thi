"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { usePurchaseDetail, usePurchaseMutations } from "@/features/purchases/api";
import { DetailState } from "@/components/DetailState";
import { AppError } from "@/lib/api/errors";

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const purchaseId = Number(id);
  const { data: purchase, isLoading, error: loadError } = usePurchaseDetail(purchaseId);
  const { receive, cancel } = usePurchaseMutations();
  const [error, setError] = useState<string | null>(null);

  if (!purchase) {
    return (
      <RequireRole capability="managePurchases">
        <DetailState isLoading={isLoading} error={loadError} loadingLabel="Đang tải phiếu nhập…" />
      </RequireRole>
    );
  }

  const isDraft = purchase.status === "DRAFT";

  function run(action: "receive" | "cancel") {
    setError(null);
    const mutation = action === "receive" ? receive : cancel;
    mutation.mutate(purchaseId, {
      onError: (e) =>
        setError(e instanceof AppError ? e.message : "Không thực hiện được thao tác."),
    });
  }

  return (
    <RequireRole capability="managePurchases">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <Link href="/purchases" className="text-sm text-slate-500 underline">← Danh sách phiếu nhập</Link>
          <h1 className="mt-1 text-xl font-semibold">{purchase.purchaseNo}</h1>
        </div>
        {/* Actions exist only while the voucher is a draft (BR3). */}
        {isDraft && (
          <div className="flex gap-2">
            <button onClick={() => run("cancel")} disabled={cancel.isPending}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
              Hủy phiếu
            </button>
            <button onClick={() => run("receive")} disabled={receive.isPending}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Xác nhận nhận hàng
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" data-testid="action-error"
           className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 grid gap-2 rounded-lg border bg-white p-4 text-sm sm:grid-cols-2">
        <p>Nhà cung cấp: {purchase.supplier?.name ?? "—"}</p>
        <p>Trạng thái: <span data-testid="purchase-status"><StatusBadge status={purchase.status} /></span></p>
        <p>Ngày lập: <DateTime value={purchase.createdAt} /></p>
        <p>Nhận hàng: {purchase.receivedAt ? <DateTime value={purchase.receivedAt} /> : "Chưa nhận"}</p>
        {purchase.note && <p className="sm:col-span-2">Ghi chú: {purchase.note}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2 text-right">Số lượng</th>
              <th className="px-3 py-2 text-right">Giá nhập</th>
              <th className="px-3 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.product?.name ?? `#${item.productId}`}</td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right"><Money value={item.unitCost} /></td>
                <td className="px-3 py-2 text-right"><Money value={item.lineTotal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-right text-base">
        Tổng tiền: <strong><Money value={purchase.total} /></strong>
      </p>
    </RequireRole>
  );
}
