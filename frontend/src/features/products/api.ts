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

export function useProductList(params: ProductListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.products.list(params),
    queryFn: async () =>
      unwrapList<ProductResponse>(
        await api.GET("/api/v1/products", {
          params: { query: { pageSize: 20, ...params } },
        }),
      ),
  });
}

/** The API rejects pageSize above this with a 400; asking for more returns nothing. */
export const MAX_PAGE_SIZE = 100;

/**
 * The whole active catalogue, for pickers that must offer every product.
 *
 * Pages through instead of asking for one big page: `pageSize: 200` is a 400
 * ("Số dòng mỗi trang phải nhỏ hơn hoặc bằng 100"), which left the purchase form's
 * product list empty and its "Thêm dòng hàng" button permanently disabled — the
 * screen could not be used at all against the real API. The mock's paginate() has no
 * cap, so nothing caught it until flow 4 was driven end to end.
 */
export function useAllProducts(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: [...qk.products.all(), "all-active"] as const,
    queryFn: async () => {
      const items: ProductResponse[] = [];
      // Bounded so a server that keeps reporting a larger total cannot spin forever.
      for (let page = 1; page <= 50; page += 1) {
        const result = unwrapList<ProductResponse>(
          await api.GET("/api/v1/products", {
            params: { query: { page, pageSize: MAX_PAGE_SIZE, isActive: true } },
          }),
        );
        items.push(...result.items);
        if (result.items.length === 0 || items.length >= result.meta.total) break;
      }
      return { items, meta: { page: 1, pageSize: items.length, total: items.length } };
    },
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
