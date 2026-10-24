"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { CategoryResponse } from "@/lib/api/types";

export type CategoryListParams = {
  page: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
};

export function useCategoryList(params: CategoryListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.categories.list(params),
    queryFn: async () =>
      unwrapList<CategoryResponse>(
        await api.GET("/api/v1/categories", {
          params: { query: { pageSize: 20, ...params } },
        }),
      ),
  });
}

export function useCategoryMutations() {
  const client = useQueryClient();
  const done = () => invalidateFor(client, "mutateCategory");

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      unwrap<CategoryResponse>(await api.POST("/api/v1/categories", { body: body as never })),
    onSuccess: done,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      unwrap<CategoryResponse>(
        await api.PATCH("/api/v1/categories/{id}", { params: { path: { id } }, body: body as never }),
      ),
    onSuccess: done,
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      unwrap<CategoryResponse>(
        active
          ? await api.POST("/api/v1/categories/{id}/activate", { params: { path: { id } } })
          : await api.POST("/api/v1/categories/{id}/deactivate", { params: { path: { id } } }),
      ),
    onSuccess: done,
  });

  return { create, update, setActive };
}
