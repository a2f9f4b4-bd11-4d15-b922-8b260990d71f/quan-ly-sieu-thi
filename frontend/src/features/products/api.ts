"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { ProductResponse } from "@/lib/api/types";

export type ProductListParams = {
  page: number;
  pageSize?: number;
  search?: string;
  categoryId?: number;
  isActive?: boolean;
};

export function useProductList(params: ProductListParams) {
  return useQuery({
    queryKey: qk.products.list(params),
    queryFn: async () =>
      unwrapList<ProductResponse>(
        await api.GET("/api/v1/products", {
          params: { query: { pageSize: 20, ...params } },
        }),
      ),
  });
}

export function useProductMutations() {
  const client = useQueryClient();
  const done = () => invalidateFor(client, "mutateProduct");

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      unwrap<ProductResponse>(await api.POST("/api/v1/products", { body: body as never })),
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      unwrap<ProductResponse>(
        await api.PATCH("/api/v1/products/{id}", { params: { path: { id } }, body: body as never }),
      ),
    onSuccess: done,
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      unwrap<ProductResponse>(
        active
          ? await api.POST("/api/v1/products/{id}/activate", { params: { path: { id } } })
          : await api.POST("/api/v1/products/{id}/deactivate", { params: { path: { id } } }),
      ),
    onSuccess: done,
  });

  return { create, update, setActive };
}
