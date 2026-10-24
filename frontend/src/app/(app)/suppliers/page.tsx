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
import { useSupplierList, useSupplierMutations } from "@/features/suppliers/api";
import type { SupplierResponse } from "@/lib/api/types";

const supplierSchema = z.object({
  name: z.string().min(1, "Tên nhà cung cấp là bắt buộc").max(150),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export default function SuppliersPage() {
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "manageSuppliers") : false;
  const query = useSupplierList({ page, search: searchParam }, { enabled: mayView });
  const { create, setActive } = useSupplierMutations();
  const [adding, setAdding] = useState(false);

  const columns: Column<SupplierResponse>[] = [
    { key: "name", header: "Nhà cung cấp", render: (s) => s.name },
    { key: "phone", header: "Điện thoại", render: (s) => s.phone || "—" },
    { key: "email", header: "Email", render: (s) => s.email || "—" },
    { key: "address", header: "Địa chỉ", render: (s) => s.address || "—" },
    { key: "status", header: "Trạng thái",
      render: (s) => <StatusBadge status={s.isActive ? "ACTIVE" : "INACTIVE"} /> },
    { key: "actions", header: "", render: (s) => (
        <button
          onClick={() => setActive.mutate({ id: s.id, active: !s.isActive })}
          disabled={setActive.isPending}
          className="text-sm text-slate-600 underline disabled:opacity-40"
        >
          {s.isActive ? "Ngừng hợp tác" : "Hợp tác lại"}
        </button>
      ) },
  ];

  return (
    <RequireRole capability="manageSuppliers">
      <h1 className="mb-4 text-xl font-semibold">Nhà cung cấp</h1>

      {adding && (
        <div className="mb-4">
          <ResourceForm
            title="Thêm nhà cung cấp"
            fields={[
              { name: "name", label: "Tên nhà cung cấp" },
              { name: "phone", label: "Điện thoại" },
              { name: "email", label: "Email" },
              { name: "address", label: "Địa chỉ" },
              { name: "note", label: "Ghi chú", type: "textarea" },
            ]}
            schema={supplierSchema}
            defaultValues={{ name: "", phone: "", email: "", address: "", note: "" }}
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
        searchPlaceholder="Tìm theo tên, điện thoại hoặc email…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có nhà cung cấp nào"
        rowTestId="supplier-row"
        actions={
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Thêm nhà cung cấp
          </button>
        }
      />
    </RequireRole>
  );
}
