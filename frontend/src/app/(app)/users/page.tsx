"use client";

import { useState } from "react";
import { z } from "zod";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { ResourceForm } from "@/components/form/ResourceForm";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useUserList, useUserMutations } from "@/features/users/api";
import { AppError, isCode } from "@/lib/api/errors";
import type { Role, UserResponse } from "@/lib/api/types";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản lý",
  CASHIER: "Nhân viên bán hàng",
  STOCKKEEPER: "Nhân viên kho",
};

const userSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập tối thiểu 3 ký tự").max(50),
  fullName: z.string().min(1, "Họ tên là bắt buộc").max(100),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(128),
  role: z.enum(["ADMIN", "CASHIER", "STOCKKEEPER"]),
});

export default function UsersPage() {
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "manageUsers") : false;
  const query = useUserList({ page, search: searchParam }, { enabled: mayView });
  const { create, setLocked } = useUserMutations();
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function toggleLock(user: UserResponse) {
    setActionError(null);
    setLocked.mutate(
      { id: user.id, locked: user.isActive },
      {
        onError: (error) => {
          // These two guards exist to stop an admin locking the store out of itself.
          if (isCode(error, "CANNOT_LOCK_SELF") || isCode(error, "LAST_ACTIVE_ADMIN")) {
            setActionError(error.message);
          } else {
            setActionError(
              error instanceof AppError ? error.message : "Không thực hiện được thao tác.",
            );
          }
        },
      },
    );
  }

  const columns: Column<UserResponse>[] = [
    { key: "username", header: "Tên đăng nhập",
      render: (u) => <span className="font-mono text-xs">{u.username}</span> },
    { key: "fullName", header: "Họ tên", render: (u) => u.fullName },
    { key: "role", header: "Vai trò", render: (u) => ROLE_LABELS[u.role] },
    { key: "status", header: "Trạng thái",
      render: (u) => <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} /> },
    { key: "actions", header: "", render: (u) => (
        <button
          onClick={() => toggleLock(u)}
          disabled={setLocked.isPending}
          className="text-sm text-slate-600 underline disabled:opacity-40"
        >
          {u.isActive ? "Khóa" : "Mở khóa"}
        </button>
      ) },
  ];

  return (
    <RequireRole capability="manageUsers">
      <h1 className="mb-4 text-xl font-semibold">Nhân viên</h1>

      {actionError && (
        <p role="alert" data-testid="action-error"
           className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {adding && (
        <div className="mb-4">
          <ResourceForm
            title="Thêm nhân viên"
            fields={[
              { name: "username", label: "Tên đăng nhập" },
              { name: "fullName", label: "Họ tên" },
              { name: "password", label: "Mật khẩu" },
              { name: "role", label: "Vai trò", type: "select",
                options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
            ]}
            schema={userSchema}
            defaultValues={{ username: "", fullName: "", password: "", role: "CASHIER" }}
            onSubmit={(values) => create.mutateAsync(values)}
            onClose={() => setAdding(false)}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        query={query}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên đăng nhập hoặc họ tên…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có nhân viên nào"
        rowTestId="user-row"
        actions={
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Thêm nhân viên
          </button>
        }
      />
    </RequireRole>
  );
}
