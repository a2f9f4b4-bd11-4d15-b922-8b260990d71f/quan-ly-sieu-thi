"use client";

import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { useReceipt } from "@/features/sales/api";

export function ReceiptDialog({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const { data, isLoading } = useReceipt(saleId);

  if (isLoading || !data) {
    return <div className="rounded-lg border bg-white p-5">Đang tải hóa đơn…</div>;
  }

  return (
    <div role="dialog" aria-label="Hóa đơn" className="rounded-lg border bg-white p-5 shadow print:border-0 print:shadow-none">
      <div className="text-center">
        <h2 className="font-semibold">{data.store.name}</h2>
        {data.store.address && <p className="text-xs text-slate-500">{data.store.address}</p>}
        {data.store.phone && <p className="text-xs text-slate-500">ĐT: {data.store.phone}</p>}
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <p>Số hóa đơn: <strong data-testid="receipt-invoice-no">{data.invoiceNo}</strong></p>
        <p>Thời điểm: <DateTime value={data.soldAt} /></p>
        <p>Thu ngân: {data.cashier?.fullName ?? "—"}</p>
        <p>Khách hàng: {data.customer?.fullName ?? "Khách lẻ"}</p>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="border-b text-left">
          <tr>
            <th className="py-1">Mặt hàng</th>
            <th className="py-1 text-right">SL</th>
            <th className="py-1 text-right">Đơn giá</th>
            <th className="py-1 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.sku} className="border-b last:border-0">
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-right">{item.quantity}</td>
              <td className="py-1 text-right"><Money value={item.unitPrice} /></td>
              <td className="py-1 text-right"><Money value={item.lineTotal} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t pt-3 text-sm">
        <p className="flex justify-between"><span>Tạm tính</span><Money value={data.subtotal} /></p>
        {data.discountAmount > 0 && (
          <p className="flex justify-between"><span>Giảm giá</span><Money value={-data.discountAmount} /></p>
        )}
        <p className="flex justify-between font-semibold"><span>Phải trả</span><Money value={data.total} /></p>
        {data.payments.map((p, i) => (
          <p key={`${p.method}-${i}`} className="flex justify-between text-slate-600">
            <span>Thanh toán ({p.method})</span><Money value={p.amount} />
          </p>
        ))}
        {data.payments.some((p) => p.changeAmount > 0) && (
          <p className="flex justify-between">
            <span>Tiền thối</span>
            <Money value={data.payments.reduce((s, p) => s + p.changeAmount, 0)} />
          </p>
        )}
        {data.customer && (
          <>
            <p data-testid="points-earned">Điểm tích lũy: {data.pointsEarned}</p>
            <p className="text-slate-600">Tổng điểm: {data.customerPointsBalance ?? 0}</p>
          </>
        )}
      </div>

      {/*
        Reprinting re-reads GET /sales/{id}/print. It must NEVER call POST /sales
        again (UC-02 E7): the invoice already exists, and a second POST would
        create a duplicate invoice and deduct stock twice.
      */}
      <div className="mt-5 flex justify-end gap-2 print:hidden">
        <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Đóng</button>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          In hóa đơn
        </button>
      </div>
    </div>
  );
}
