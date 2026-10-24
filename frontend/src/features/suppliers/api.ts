"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { SupplierResponse } from "@/lib/api/types";

export function useSupplierList(
  params: { page: number; pageSize?: number; search?: string; isActive?: boolean },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.suppliers.list(params),
    queryFn: async () =>
      unwrapList<SupplierResponse>(
        await api.GET("/api/v1/suppliers", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useSupplierMutations() {
  const client = useQueryClient();
  const done = () => invalidateFor(client, "mutateSupplier");

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      unwrap<SupplierResponse>(await api.POST("/api/v1/suppliers", { body: body as never })),
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      unwrap<SupplierResponse>(
        await api.PATCH("/api/v1/suppliers/{id}", { params: { path: { id } }, body: body as never }),
      ),
    onSuccess: done,
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      unwrap<SupplierResponse>(
        active
          ? await api.POST("/api/v1/suppliers/{id}/activate", { params: { path: { id } } })
          : await api.POST("/api/v1/suppliers/{id}/deactivate", { params: { path: { id } } }),
      ),
    onSuccess: done,
  });

  return { create, update, setActive };
}
