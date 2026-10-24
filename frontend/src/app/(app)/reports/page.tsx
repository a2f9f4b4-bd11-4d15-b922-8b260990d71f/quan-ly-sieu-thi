"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { can, type Capability } from "@/lib/auth/permissions";

const REPORTS: Array<{ href: string; title: string; description: string; capability: Capability }> = [
  { href: "/reports/revenue", title: "Doanh thu", capability: "viewRevenueReports",
    description: "Doanh thu theo ngày hoặc tháng, kèm giảm giá và doanh thu thuần." },
  { href: "/reports/top-products", title: "Sản phẩm bán chạy", capability: "viewRevenueReports",
    description: "Xếp hạng theo số lượng bán hoặc theo doanh thu." },
  { href: "/reports/gross-profit", title: "Lợi nhuận gộp", capability: "viewRevenueReports",
    description: "Doanh thu trừ giá vốn đã chụp lúc bán, kèm tỷ suất." },
  { href: "/reports/inventory", title: "Tồn kho", capability: "viewInventoryReport",
    description: "Giá trị tồn, nhập/xuất/điều chỉnh trong kỳ và cảnh báo tồn thấp." },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const visible = REPORTS.filter((r) => (user ? can(user.role, r.capability) : false));

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Báo cáo</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => (
          <Link key={r.href} href={r.href}
                className="rounded-lg border bg-white p-4 hover:border-slate-400">
            <h2 className="font-medium">{r.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
