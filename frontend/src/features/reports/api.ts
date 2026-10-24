"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import type { Schemas } from "@/lib/api/types";

export type RevenueReport = Schemas["RevenueReportResponse"];
export type TopProductsReport = Schemas["TopProductsReportResponse"];
export type GrossProfitReport = Schemas["GrossProfitReportResponse"];
export type InventoryReport = Schemas["InventoryReportResponse"];

type Range = { from: string; to: string; enabled: boolean };

export function useRevenueReport({ from, to, groupBy, enabled }: Range & { groupBy: "day" | "month" }) {
  return useQuery({
    enabled,
    queryKey: qk.reports.revenue({ from, to, groupBy }),
    queryFn: async () =>
      unwrap<RevenueReport>(
        await api.GET("/api/v1/reports/revenue", { params: { query: { from, to, groupBy } } }),
      ),
  });
}

export function useTopProductsReport({ from, to, sortBy, limit, enabled }: Range & {
  sortBy: "quantity" | "revenue"; limit: number;
}) {
  return useQuery({
    enabled,
    queryKey: qk.reports.topProducts({ from, to, sortBy, limit }),
    queryFn: async () =>
      unwrap<TopProductsReport>(
        await api.GET("/api/v1/reports/top-products", { params: { query: { from, to, sortBy, limit } } }),
      ),
  });
}

export function useGrossProfitReport({ from, to, groupBy, enabled }: Range & { groupBy: "day" | "month" }) {
  return useQuery({
    enabled,
    queryKey: qk.reports.grossProfit({ from, to, groupBy }),
    queryFn: async () =>
      unwrap<GrossProfitReport>(
        await api.GET("/api/v1/reports/gross-profit", { params: { query: { from, to, groupBy } } }),
      ),
  });
}

export function useInventoryReport({ from, to, categoryId, enabled }: Range & { categoryId?: number }) {
  return useQuery({
    enabled,
    queryKey: qk.reports.inventory({ from, to, categoryId }),
    queryFn: async () =>
      unwrap<InventoryReport>(
        await api.GET("/api/v1/reports/inventory", {
          params: { query: { from, to, categoryId, page: 1, pageSize: 50 } },
        }),
      ),
  });
}
