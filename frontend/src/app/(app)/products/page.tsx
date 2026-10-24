"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { Money } from "@/components/Money";
import { StatusBadge } from "@/components/StatusBadge";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useProductList, useProductMutations } from "@/features/products/api";
import { useCategoryList } from "@/features/categories/api";
import type { ProductResponse } from "@/lib/api/types";

export default function ProductsPage() {
  const { user } = useAuth();
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const query = useProductList({ page, search: searchParam, categoryId });
  const categories = useCategoryList({ page: 1, pageSize: 100 });
  const { setActive } = useProductMutations();

  const showCost = user ? can(user.role, "viewCostPrice") : false;
  const canEdit = user ? can(user.role, "manageProducts") : false;

  const columns: Column<ProductResponse>[] = [
    { key: "sku", header: "SKU", render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
    { key: "name", header: "Tên sản phẩm", render: (p) => p.name },
    { key: "unit", header: "ĐVT", render: (p) => p.unit },
    { key: "category", header: "Danh mục", render: (p) => p.category?.name ?? "—" },
    { key: "salePrice", header: "Giá bán", className: "text-right",
      render: (p) => <Money value={p.salePrice} /> },
    // costPrice is absent from the payload for a CASHIER — never render the column either.
    ...(showCost
      ? [{ key: "costPrice", header: "Giá vốn", className: "text-right",
           render: (p: ProductResponse) => <Money value={p.costPrice ?? 0} /> }]
      : []),
    { key: "stockQty", header: "Tồn", className: "text-right",
      render: (p) => (
        <span className={p.stockQty <= p.reorderLevel ? "font-semibold text-red-600" : ""}>
          {p.stockQty}
        </span>
      ) },
    { key: "status", header: "Trạng thái",
      render: (p) => <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ...(canEdit
      ? [{ key: "actions", header: "", render: (p: ProductResponse) => (
            <button
              onClick={(e) => { e.stopPropagation(); setActive.mutate({ id: p.id, active: !p.isActive }); }}
              disabled={setActive.isPending}
              className="text-sm text-slate-600 underline disabled:opacity-40"
            >
              {p.isActive ? "Ngừng bán" : "Bán lại"}
            </button>
          ) }]
      : []),
  ];

  return (
    <RequireRole capability="viewStock">
      <h1 className="mb-4 text-xl font-semibold">Sản phẩm</h1>
      <DataTable
        columns={columns}
        query={query}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, SKU hoặc mã vạch…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Không tìm thấy sản phẩm nào"
        rowTestId="product-row"
        filters={
          <select
            aria-label="Danh mục"
            value={categoryId ?? ""}
            onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="rounded-md border px-3 py-2"
          >
            <option value="">Tất cả danh mục</option>
            {categories.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        }
      />
    </RequireRole>
  );
}
