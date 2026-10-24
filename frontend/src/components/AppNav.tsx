"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { can, type Capability } from "@/lib/auth/permissions";
import type { Role } from "@/lib/api/types";

type NavItem = { href: string; label: string; capability?: Capability };

const ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/pos", label: "Bán hàng", capability: "sell" },
  { href: "/sales", label: "Hóa đơn", capability: "viewSales" },
  { href: "/customers", label: "Khách hàng", capability: "manageCustomers" },
  { href: "/products", label: "Sản phẩm", capability: "viewStock" },
  { href: "/categories", label: "Danh mục", capability: "viewStock" },
  { href: "/suppliers", label: "Nhà cung cấp", capability: "manageSuppliers" },
  { href: "/purchases", label: "Phiếu nhập", capability: "managePurchases" },
  { href: "/inventory", label: "Tồn kho", capability: "viewStock" },
  { href: "/inventory/counts", label: "Kiểm kê", capability: "countStock" },
  { href: "/inventory/movements", label: "Biến động kho", capability: "viewMovements" },
  { href: "/reports", label: "Báo cáo", capability: "viewInventoryReport" },
  { href: "/users", label: "Nhân viên", capability: "manageUsers" },
  { href: "/profile", label: "Hồ sơ" },
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản lý",
  CASHIER: "Nhân viên bán hàng",
  STOCKKEEPER: "Nhân viên kho",
};

export function AppNav({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Hiding items is a convenience only; the server rejects what the role may not do.
  const visible = ITEMS.filter((item) => !item.capability || can(role, item.capability));

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r bg-white">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Siêu thị Mini 09</p>
        <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {visible.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t px-4 py-3">
        <p className="truncate text-sm font-medium">{user?.fullName}</p>
        <button
          onClick={() => void logout()}
          className="mt-2 w-full rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
