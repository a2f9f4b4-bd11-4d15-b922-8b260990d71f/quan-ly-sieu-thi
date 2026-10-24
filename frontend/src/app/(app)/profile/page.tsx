"use client";

import { useAuth } from "@/lib/auth/context";
import type { Role } from "@/lib/api/types";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản lý",
  CASHIER: "Nhân viên bán hàng",
  STOCKKEEPER: "Nhân viên kho",
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Hồ sơ cá nhân</h1>

      <div className="max-w-md space-y-3 rounded-lg border bg-white p-5 text-sm">
        <p className="flex justify-between">
          <span className="text-slate-500">Họ tên</span>
          <strong data-testid="profile-name">{user.fullName}</strong>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Tên đăng nhập</span>
          <span className="font-mono text-xs">{user.username}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Vai trò</span>
          <span data-testid="profile-role">{ROLE_LABELS[user.role]}</span>
        </p>

        {/* Accurate: the API exposes only an admin-driven reset-password. */}
        <p className="border-t pt-3 text-slate-500">
          Để đổi mật khẩu, vui lòng liên hệ quản lý. Hệ thống phiên bản này chưa hỗ trợ
          tự đổi mật khẩu.
        </p>

        <button
          onClick={() => void logout()}
          className="w-full rounded-md border px-4 py-2 font-medium hover:bg-slate-50"
        >
          Đăng xuất
        </button>
      </div>
    </>
  );
}
