"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { invalidateFor } from "@/lib/query/invalidation";
import { qk } from "@/lib/query/keys";
import type { MovementResponse, MovementType, StockCountResponse, StockCountResultResponse, StockItemResponse } from "@/lib/api/types";

export type StockListParams = {
  page: number; pageSize?: number; search?: string;
  categoryId?: number; lowStock?: boolean; isActive?: boolean;
};

export function useStockList(params: StockListParams) {
  return useQuery({
    queryKey: qk.inventory.stock(params),
    queryFn: async () =>
      unwrapList<StockItemResponse>(
        await api.GET("/api/v1/inventory/stock", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useLowStockList(
  params: { page: number; pageSize?: number; search?: string },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.inventory.lowStock(params),
    queryFn: async () =>
      unwrapList<StockItemResponse>(
        await api.GET("/api/v1/inventory/low-stock", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useMovementList(params: {
  page: number; pageSize?: number; productId?: number; type?: MovementType;
}) {
  return useQuery({
    queryKey: qk.inventory.movements(params),
    queryFn: async () =>
      unwrapList<MovementResponse>(
        await api.GET("/api/v1/inventory/movements", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useStockCountList(params: { page: number; pageSize?: number }) {
  return useQuery({
    queryKey: qk.inventory.counts(params),
    queryFn: async () =>
      unwrapList<StockCountResponse>(
        await api.GET("/api/v1/inventory/stock-counts", {
          params: { query: { pageSize: 20, ...params } },
        }),
      ),
  });
}

export type StockCountInput = {
  productId: number;
  countedQty: number;
  reason: string;
  /** The quantity the operator actually saw on screen — the conflict guard. */
  expectedSystemQty: number;
};

export function useCreateStockCount() {
  const client = useQueryClient();
  return useMutation({
    // The API answers with { stockCount, product }, not a bare count.
    mutationFn: async (input: StockCountInput) =>
      unwrap<StockCountResultResponse>(
        await api.POST("/api/v1/inventory/stock-counts", { body: input as never }),
      ),
    onSuccess: () => invalidateFor(client, "createStockCount"),
  });
}
