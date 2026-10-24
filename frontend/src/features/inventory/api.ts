"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import type { MovementResponse, MovementType, StockItemResponse } from "@/lib/api/types";

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

export function useLowStockList(params: { page: number; pageSize?: number; search?: string }) {
  return useQuery({
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
