"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { CustomerResponse } from "@/lib/api/types";

export function useCustomerList(
  params: { page: number; pageSize?: number; search?: string },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.customers.list(params),
    queryFn: async () =>
      unwrapList<CustomerResponse>(
        await api.GET("/api/v1/customers", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

/**
 * A mutation, not a query: the POS fires it on demand from an input, and a 404
 * is an expected answer ("khách mới") rather than a cache miss.
 */
export function useCustomerLookup() {
  return useMutation({
    mutationFn: async (q: string) =>
      unwrap<CustomerResponse>(
        await api.GET("/api/v1/customers/lookup", { params: { query: { q } } }),
      ),
  });
}

export function useCustomerMutations() {
  const client = useQueryClient();
  const done = () => invalidateFor(client, "mutateCustomer");

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      unwrap<CustomerResponse>(await api.POST("/api/v1/customers", { body: body as never })),
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      unwrap<CustomerResponse>(
        await api.PATCH("/api/v1/customers/{id}", { params: { path: { id } }, body: body as never }),
      ),
    onSuccess: done,
  });

  return { create, update };
}
