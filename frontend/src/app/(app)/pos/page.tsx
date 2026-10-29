"use client";

import { useState } from "react";
import { RequireRole } from "@/lib/auth/RequireRole";
import { Money } from "@/components/Money";
import { ScannerInput } from "@/components/pos/ScannerInput";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { useCart } from "@/features/pos/useCart";
import { useCreateSale, type PaymentInput } from "@/features/sales/api";
import { describeSaleError, type StockIssue } from "@/features/sales/saleError";
import { useCustomerLookup } from "@/features/customers/api";
import { api, unwrap } from "@/lib/api/client";
import { AppError } from "@/lib/api/errors";
import type { CustomerResponse, ProductResponse } from "@/lib/api/types";

export default function PosPage() {
  const { lines, addProduct, setQuantity, removeLine, clear, subtotal, toItems } = useCart();
  const createSale = useCreateSale();
  const lookupCustomer = useCustomerLookup();

  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerNote, setCustomerNote] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<number | null>(null);

  const amountDue = Math.max(0, subtotal - discount);

  async function handleScan(code: string) {
    setScanError(null);
    try {
      const product = unwrap<ProductResponse>(
        await api.GET("/api/v1/products/lookup", { params: { query: { code } } }),
      );
      addProduct(product);
    } catch (error) {
      // UC-02 E1 — unknown or discontinued codes never enter the cart.
      setScanError(error instanceof AppError ? error.message : `Không tìm thấy mã "${code}".`);
    }
  }

  async function handleCustomerLookup() {
    setCustomerNote(null);
    const q = customerQuery.trim();
    if (!q) return;
    try {
      setCustomer(await lookupCustomer.mutateAsync(q));
    } catch {
      // UC-02 E5 — never silently attach the wrong customer.
      setCustomer(null);
      setCustomerNote(`Không tìm thấy khách "${q}". Có thể bán không gắn khách.`);
    }
  }

  function checkout(payments: PaymentInput[]) {
    setStockIssues([]);
    setPaymentError(null);

    createSale.mutate(
      { customerId: customer?.id, items: toItems(), discountAmount: discount, payments },
      {
        onSuccess: (sale) => {
          setCompletedSaleId(sale.id);
          clear();                 // cart empties only after a confirmed write
          setDiscount(0);
          setCustomer(null);
          setCustomerQuery("");
          setPaying(false);
        },
        onError: (error) => {
          const view = describeSaleError(error);
          if (view.kind === "stock") {
            setStockIssues(view.issues);
            setPaying(false);
            return;
          }
          setPaymentError(view.message);
        },
      },
    );
  }

  return (
    <RequireRole capability="sell">
      <h1 className="mb-4 text-xl font-semibold">Bán hàng</h1>

      {completedSaleId !== null ? (
        <ReceiptDialog saleId={completedSaleId} onClose={() => setCompletedSaleId(null)} />
      ) : paying ? (
        <PaymentDialog
          amountDue={amountDue}
          pending={createSale.isPending}
          errorMessage={paymentError}
          onConfirm={checkout}
          onCancel={() => { setPaying(false); setPaymentError(null); }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-3">
            <ScannerInput onScan={handleScan} />
            {scanError && (
              <p role="alert" data-testid="scan-error" className="text-sm text-red-600">{scanError}</p>
            )}

            {stockIssues.length > 0 && (
              <div role="alert" data-testid="stock-issues"
                   className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
                <p className="font-medium text-red-800">Không đủ tồn kho</p>
                <ul className="mt-2 space-y-1">
                  {stockIssues.map((issue) => (
                    <li key={issue.productId} className="flex items-center gap-2">
                      <span>{issue.name}: còn {issue.available}, đang bán {issue.requested}</span>
                      <button
                        onClick={() => setQuantity(issue.productId, issue.available)}
                        className="rounded border bg-white px-2 py-0.5 text-xs"
                      >
                        Sửa về {issue.available}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Sản phẩm</th>
                    <th className="px-3 py-2">ĐVT</th>
                    <th className="px-3 py-2 text-right">Đơn giá</th>
                    <th className="px-3 py-2 text-right">Số lượng</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-500">
                      Giỏ hàng trống — quét mã để bắt đầu
                    </td></tr>
                  )}
                  {lines.map((line) => (
                    <tr key={line.productId} data-testid="cart-row" className="border-t">
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2">{line.unit}</td>
                      <td className="px-3 py-2 text-right"><Money value={line.unitPrice} /></td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number" min={1} step={1} value={line.quantity}
                          aria-label={`Số lượng ${line.name}`}
                          onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                          className="w-20 rounded border px-2 py-1 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={line.unitPrice * line.quantity} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeLine(line.productId)}
                                className="text-xs text-slate-500 underline">Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">Khách hàng</h2>
              <div className="flex gap-2">
                <input
                  aria-label="Số điện thoại hoặc mã khách"
                  placeholder="0901234567"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCustomerLookup(); } }}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <button onClick={() => void handleCustomerLookup()}
                        className="rounded-md border px-3 py-2 text-sm">Tra cứu</button>
              </div>
              {customer && (
                <p className="mt-2 text-sm" data-testid="attached-customer">
                  {customer.fullName} — {customer.loyaltyPoints} điểm
                </p>
              )}
              {customerNote && (
                <p role="alert" data-testid="customer-note" className="mt-2 text-sm text-amber-700">
                  {customerNote}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border bg-white p-4 text-sm">
              <p className="flex justify-between">
                <span>Tạm tính</span>
                <strong data-testid="cart-subtotal"><Money value={subtotal} /></strong>
              </p>
              <label className="flex items-center justify-between gap-2">
                <span>Giảm giá</span>
                <input
                  type="number" min={0} aria-label="Giảm giá" value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-32 rounded border px-2 py-1 text-right"
                />
              </label>
              <p className="flex justify-between border-t pt-2 text-base">
                <span>Phải trả</span>
                <strong data-testid="cart-total"><Money value={amountDue} /></strong>
              </p>
              <button
                onClick={() => { setPaymentError(null); setPaying(true); }}
                disabled={lines.length === 0}
                className="mt-2 w-full rounded-md bg-slate-900 py-2 font-medium text-white disabled:opacity-40"
              >
                Thanh toán
              </button>
            </div>
          </aside>
        </div>
      )}
    </RequireRole>
  );
}
