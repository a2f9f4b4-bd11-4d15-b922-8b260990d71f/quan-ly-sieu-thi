"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { PurchaseDetailResponse, PurchaseStatus, Schemas } from "@/lib/api/types";

export type PurchaseListItem = Schemas["PurchaseListItemResponse"];

export function usePurchaseList(
  params: {
    page: number; pageSize?: number; search?: string; status?: PurchaseStatus; supplierId?: number;
  },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.purchases.list(params),
    queryFn: async () =>
      unwrapList<PurchaseListItem>(
        await api.GET("/api/v1/purchases", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function usePurchaseDetail(id: number | null) {
  return useQuery({
    enabled: id !== null,
    queryKey: qk.purchases.detail(id ?? 0),
    queryFn: async () =>
      unwrap<PurchaseDetailResponse>(
        await api.GET("/api/v1/purchases/{id}", { params: { path: { id: id as number } } }),
      ),
  });
}

export type PurchaseLineInput = { productId: number; quantity: number; unitCost: number };

export function usePurchaseMutations() {
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: async (body: { supplierId: number; note?: string; receiveNow?: boolean; items: PurchaseLineInput[] }) =>
      unwrap<PurchaseDetailResponse>(await api.POST("/api/v1/purchases", { body: body as never })),
    onSuccess: () => invalidateFor(client, "createPurchase"),
  });

  const receive = useMutation({
    mutationFn: async (id: number) =>
      unwrap<PurchaseDetailResponse>(
        await api.POST("/api/v1/purchases/{id}/receive", { params: { path: { id } } }),
      ),
    // Receiving changes stock AND weighted-average cost, so products go stale too.
    onSuccess: () => invalidateFor(client, "receivePurchase"),
  });

  const cancel = useMutation({
    mutationFn: async (id: number) =>
      unwrap<PurchaseDetailResponse>(
        await api.POST("/api/v1/purchases/{id}/cancel", { params: { path: { id } } }),
      ),
    onSuccess: () => invalidateFor(client, "cancelPurchase"),
  });

  return { create, receive, cancel };
}
