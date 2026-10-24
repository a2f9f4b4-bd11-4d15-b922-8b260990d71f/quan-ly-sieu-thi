"use client";

import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useCategoryList, useCategoryMutations } from "@/features/categories/api";
import type { CategoryResponse } from "@/lib/api/types";

export default function CategoriesPage() {
  const { user } = useAuth();
  const mayView = user ? can(user.role, "viewStock") : false;
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const query = useCategoryList({ page, search: searchParam }, { enabled: mayView });
  const { setActive } = useCategoryMutations();

  const canEdit = user ? can(user.role, "manageCategories") : false;

  const columns: Column<CategoryResponse>[] = [
    { key: "name", header: "Tên danh mục", render: (c) => c.name },
    { key: "description", header: "Mô tả", render: (c) => c.description || "—" },
    { key: "status", header: "Trạng thái",
      render: (c) => <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ...(canEdit
      ? [{ key: "actions", header: "", render: (c: CategoryResponse) => (
            <button
              onClick={() => setActive.mutate({ id: c.id, active: !c.isActive })}
              disabled={setActive.isPending}
              className="text-sm text-slate-600 underline disabled:opacity-40"
            >
              {c.isActive ? "Ngừng dùng" : "Dùng lại"}
            </button>
          ) }]
      : []),
  ];

  return (
    <RequireRole capability="viewStock">
      <h1 className="mb-4 text-xl font-semibold">Danh mục</h1>
      <DataTable
        columns={columns}
        query={query}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên danh mục…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có danh mục nào"
        rowTestId="category-row"
      />
    </RequireRole>
  );
}
