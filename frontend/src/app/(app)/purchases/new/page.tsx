"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Money } from "@/components/Money";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useSupplierList } from "@/features/suppliers/api";
import { useProductList } from "@/features/products/api";
import { usePurchaseMutations, type PurchaseLineInput } from "@/features/purchases/api";
import { AppError } from "@/lib/api/errors";

export default function NewPurchasePage() {
  const router = useRouter();
  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "managePurchases") : false;
  const suppliers = useSupplierList({ page: 1, pageSize: 100, isActive: true }, { enabled: mayView });
  const products = useProductList({ page: 1, pageSize: 200 }, { enabled: mayView });
  const { create } = usePurchaseMutations();

  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

  function addLine() {
    const first = products.data?.items[0];
    if (!first) return;
    setLines((c) => [...c, { productId: first.id, quantity: 1, unitCost: first.costPrice ?? 0 }]);
  }

  function update(index: number, patch: Partial<PurchaseLineInput>) {
    setLines((c) => c.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function save(receiveNow: boolean) {
    setError(null);
    if (!supplierId) { setError("Vui lòng chọn nhà cung cấp."); return; }
    if (lines.length === 0) { setError("Phiếu nhập phải có ít nhất một dòng hàng."); return; }
    try {
      const created = await create.mutateAsync({ supplierId, note, items: lines, receiveNow });
      router.push(`/purchases/${created.id}`);
    } catch (e) {
      setError(e instanceof AppError ? e.message : "Không lưu được phiếu nhập.");
    }
  }

  return (
    <RequireRole capability="managePurchases">
      <Link href="/purchases" className="text-sm text-slate-500 underline">← Danh sách phiếu nhập</Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Tạo phiếu nhập</h1>

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nhà cung cấp</span>
          <select
            aria-label="Nhà cung cấp"
            value={supplierId ?? ""}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full max-w-md rounded-md border px-3 py-2"
          >
            <option value="">— Chọn nhà cung cấp —</option>
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">Giá nhập</th>
                <th className="px-3 py-2 text-right">Thành tiền</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Chưa có dòng hàng nào
                </td></tr>
              )}
              {lines.map((line, index) => (
                <tr key={index} data-testid="purchase-line" className="border-t">
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Sản phẩm dòng ${index + 1}`}
                      value={line.productId}
                      onChange={(e) => update(index, { productId: Number(e.target.value) })}
                      className="w-full rounded border px-2 py-1"
                    >
                      {products.data?.items.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={1} step={1} value={line.quantity}
                           aria-label={`Số lượng dòng ${index + 1}`}
                           onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                           className="w-24 rounded border px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} value={line.unitCost}
                           aria-label={`Giá nhập dòng ${index + 1}`}
                           onChange={(e) => update(index, { unitCost: Number(e.target.value) })}
                           className="w-32 rounded border px-2 py-1 text-right" />
                  </td>
                  <td className="px-3 py-2 text-right"><Money value={line.quantity * line.unitCost} /></td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                            className="text-xs text-slate-500 underline">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* addLine() needs a product to default to; without this guard the
            button silently does nothing while the list is still loading. */}
        <button
          onClick={addLine}
          disabled={!products.data?.items.length}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {products.isLoading ? "Đang tải sản phẩm…" : "Thêm dòng hàng"}
        </button>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Ghi chú</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
                    className="w-full max-w-md rounded-md border px-3 py-2" />
        </label>

        <p className="text-right text-base">
          Tổng tiền: <strong data-testid="purchase-total"><Money value={total} /></strong>
        </p>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Lưu ý: khi lưu, toàn bộ danh sách hàng sẽ được ghi đè. Nếu người khác vừa sửa
          phiếu này, hãy tải lại trước khi lưu để tránh mất thay đổi của họ.
        </p>

        {error && (
          <p role="alert" data-testid="form-error" className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={() => void save(false)} disabled={create.isPending}
                  className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
            Lưu nháp
          </button>
          <button onClick={() => void save(true)} disabled={create.isPending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Lưu và nhận hàng
          </button>
        </div>
      </div>
    </RequireRole>
  );
}
