"use client";

import { useMemo, useState } from "react";
import { Money } from "@/components/Money";
import { formatVnd } from "@/lib/format/money";
import type { PaymentInput } from "@/features/sales/api";
import type { PaymentMethod } from "@/lib/api/types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  OTHER: "Khác",
};

const MAX_PAYMENTS = 10;

export function PaymentDialog({
  amountDue, pending, errorMessage, onConfirm, onCancel,
}: {
  amountDue: number;
  pending: boolean;
  errorMessage: string | null;
  onConfirm: (payments: PaymentInput[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<PaymentInput[]>([
    { method: "CASH", amount: amountDue, tenderedAmount: amountDue },
  ]);

  const paid = useMemo(() => rows.reduce((sum, r) => sum + (r.amount || 0), 0), [rows]);
  const remaining = amountDue - paid;
  // Payments must sum exactly; keeping the button disabled means the common
  // case never reaches the server as a 422.
  const balanced = Math.round(remaining) === 0;

  function update(index: number, patch: Partial<PaymentInput>) {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div role="dialog" aria-label="Thanh toán" className="rounded-lg border bg-white p-5 shadow">
      <h2 className="mb-1 text-lg font-semibold">Thanh toán</h2>
      <p className="mb-4 text-sm text-slate-500">
        Phải trả: <strong data-testid="amount-due"><Money value={amountDue} /></strong>
      </p>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium">Phương thức</span>
              <select
                aria-label={`Phương thức ${index + 1}`}
                value={row.method}
                onChange={(e) => update(index, { method: e.target.value as PaymentMethod })}
                className="rounded-md border px-3 py-2"
              >
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-xs font-medium">Số tiền</span>
              <input
                type="number" aria-label={`Số tiền ${index + 1}`} value={row.amount}
                onChange={(e) => update(index, { amount: Number(e.target.value) })}
                className="w-36 rounded-md border px-3 py-2"
              />
            </label>

            {row.method === "CASH" && (
              <label className="space-y-1">
                <span className="block text-xs font-medium">Tiền khách đưa</span>
                <input
                  type="number" aria-label="Tiền khách đưa" value={row.tenderedAmount ?? row.amount}
                  onChange={(e) => update(index, { tenderedAmount: Number(e.target.value) })}
                  className="w-36 rounded-md border px-3 py-2"
                />
              </label>
            )}

            {row.method !== "CASH" && (
              <label className="space-y-1">
                <span className="block text-xs font-medium">Mã tham chiếu</span>
                <input
                  aria-label={`Mã tham chiếu ${index + 1}`} value={row.reference ?? ""}
                  onChange={(e) => update(index, { reference: e.target.value })}
                  className="w-44 rounded-md border px-3 py-2"
                />
              </label>
            )}

            {rows.length > 1 && (
              <button
                onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Xóa
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.length < MAX_PAYMENTS && (
        <button
          onClick={() => setRows((c) => [...c, { method: "TRANSFER", amount: Math.max(0, remaining) }])}
          className="mt-3 text-sm text-slate-600 underline"
        >
          Thêm phương thức
        </button>
      )}

      <div className="mt-4 space-y-1 border-t pt-3 text-sm">
        <p>Đã nhập: <Money value={paid} /></p>
        {!balanced && (
          <p data-testid="payment-balance" className="font-medium text-red-600">
            {remaining > 0
              ? `Còn thiếu ${formatVnd(remaining)}`
              : `Thừa ${formatVnd(-remaining)}`}
          </p>
        )}
        {rows[0]?.method === "CASH" && balanced && (
          <p>
            Tiền thối:{" "}
            <strong data-testid="change-amount">
              <Money value={Math.max(0, (rows[0].tenderedAmount ?? rows[0].amount) - rows[0].amount)} />
            </strong>
          </p>
        )}
      </div>

      {errorMessage && (
        <p role="alert" data-testid="payment-error" className="mt-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">Hủy</button>
        <button
          onClick={() => onConfirm(rows)}
          disabled={!balanced || pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang xử lý…" : "Xác nhận thanh toán"}
        </button>
      </div>
    </div>
  );
}
