"use client";

import Link from "next/link";
import { Money } from "@/components/Money";
import { DateTime } from "@/components/DateTime";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useRevenueReport } from "@/features/reports/api";
import { useLowStockList } from "@/features/inventory/api";
import { useSaleList } from "@/features/sales/api";
import { usePurchaseList } from "@/features/purchases/api";
import { toStoreDateString } from "@/lib/format/datetime";

function Card({ title, children, href }: { title: string; children: React.ReactNode; href?: string }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href && <Link href={href} className="text-xs text-slate-500 underline">Xem tất cả</Link>}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = toStoreDateString(new Date());

  // There is no dashboard endpoint — each card is an existing read-only query,
  // and each is enabled only for roles allowed to call it, so no card 403s.
  const maySeeRevenue = user ? can(user.role, "viewRevenueReports") : false;
  const maySeeLowStock = user ? can(user.role, "viewLowStock") : false;
  const maySeeSales = user ? can(user.role, "viewSales") : false;
  const maySeePurchases = user ? can(user.role, "managePurchases") : false;
  const maySell = user ? can(user.role, "sell") : false;

  const revenue = useRevenueReport({ from: today, to: today, groupBy: "day", enabled: maySeeRevenue });
  const lowStock = useLowStockList({ page: 1, pageSize: 10 }, { enabled: maySeeLowStock });
  const sales = useSaleList(
    { page: 1, pageSize: 5, cashierId: maySell && !maySeeRevenue ? user?.id : undefined },
    { enabled: maySeeSales },
  );
  const purchases = usePurchaseList({ page: 1, pageSize: 5, status: "DRAFT" }, { enabled: maySeePurchases });

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Xin chào, {user?.fullName}</h1>
      <p className="mb-4 text-sm text-slate-500">Hôm nay {today}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {maySell && (
          <Card title="Bán hàng">
            <Link href="/pos"
                  className="block rounded-md bg-slate-900 px-4 py-6 text-center text-lg font-medium text-white">
              Mở màn hình bán hàng
            </Link>
          </Card>
        )}

        {maySeeRevenue && (
          <Card title="Doanh thu hôm nay" href="/reports/revenue">
            <p className="text-2xl font-semibold" data-testid="today-revenue">
              <Money value={revenue.data?.totals.netRevenue ?? 0} />
            </p>
            <p className="text-sm text-slate-500">
              {revenue.data?.totals.invoiceCount ?? 0} hóa đơn
            </p>
          </Card>
        )}

        {maySeeLowStock && (
          <Card title="Sắp hết hàng" href="/inventory">
            {lowStock.data?.items.length === 0 ? (
              <p className="text-sm text-slate-500">Không có mặt hàng nào dưới ngưỡng.</p>
            ) : (
              <ul className="space-y-1 text-sm" data-testid="low-stock-list">
                {lowStock.data?.items.map((item) => (
                  <li key={item.productId} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-medium text-red-600">{item.stockQty} {item.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {maySeeSales && (
          <Card title="Hóa đơn gần đây" href="/sales">
            {sales.data?.items.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có hóa đơn nào.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sales.data?.items.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{s.invoiceNo}</span>
                    <DateTime value={s.soldAt} />
                    <Money value={s.total} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {maySeePurchases && (
          <Card title="Phiếu nhập nháp" href="/purchases">
            {purchases.data?.items.length === 0 ? (
              <p className="text-sm text-slate-500">Không có phiếu nháp.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {purchases.data?.items.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={`/purchases/${p.id}`} className="font-mono text-xs underline">
                      {p.purchaseNo}
                    </Link>
                    <span>{p.supplier?.name}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
