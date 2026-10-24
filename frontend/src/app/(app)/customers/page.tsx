"use client";

import { useState } from "react";
import { z } from "zod";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { useListState } from "@/components/data-table/useListQuery";
import { ResourceForm } from "@/components/form/ResourceForm";
import { DateTime } from "@/components/DateTime";
import { RequireRole } from "@/lib/auth/RequireRole";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { useCustomerList, useCustomerMutations } from "@/features/customers/api";
import type { CustomerResponse } from "@/lib/api/types";

const customerSchema = z.object({
  fullName: z.string().min(1, "Tên khách hàng là bắt buộc").max(100),
  phone: z
    .string()
    .regex(/^0\d{9,10}$/, "Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
});

export default function CustomersPage() {
  const { search, setSearch, page, setPage, searchParam } = useListState();
  const { user } = useAuth();
  // Never issue a request this role cannot make, even via a direct URL.
  const mayView = user ? can(user.role, "manageCustomers") : false;
  const query = useCustomerList({ page, search: searchParam }, { enabled: mayView });
  const { create } = useCustomerMutations();
  const [adding, setAdding] = useState(false);

  const columns: Column<CustomerResponse>[] = [
    { key: "customerCode", header: "Mã KH",
      render: (c) => <span className="font-mono text-xs">{c.customerCode}</span> },
    { key: "fullName", header: "Tên khách hàng", render: (c) => c.fullName },
    { key: "phone", header: "Điện thoại", render: (c) => c.phone || "—" },
    { key: "loyaltyPoints", header: "Điểm", className: "text-right",
      render: (c) => c.loyaltyPoints },
    { key: "createdAt", header: "Ngày tạo",
      render: (c) => <DateTime value={c.createdAt} withTime={false} /> },
  ];

  return (
    <RequireRole capability="manageCustomers">
      <h1 className="mb-4 text-xl font-semibold">Khách hàng</h1>

      {adding && (
        <div className="mb-4">
          <ResourceForm
            title="Thêm khách hàng"
            fields={[
              { name: "fullName", label: "Tên khách hàng" },
              { name: "phone", label: "Số điện thoại", placeholder: "0901234567" },
              { name: "email", label: "Email" },
            ]}
            schema={customerSchema}
            defaultValues={{ fullName: "", phone: "", email: "" }}
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
        searchPlaceholder="Tìm theo tên, mã hoặc số điện thoại…"
        page={page}
        onPageChange={setPage}
        emptyMessage="Chưa có khách hàng nào"
        rowTestId="customer-row"
        actions={
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Thêm khách hàng
          </button>
        }
      />
    </RequireRole>
  );
}
