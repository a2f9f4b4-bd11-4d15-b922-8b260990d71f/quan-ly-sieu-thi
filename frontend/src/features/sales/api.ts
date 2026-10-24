"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { PaymentMethod, SaleDetailResponse, Schemas } from "@/lib/api/types";

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  reference?: string;
};

export type CheckoutInput = {
  customerId?: number;
  items: Array<{ productId: number; quantity: number }>;
  discountAmount?: number;
  payments: PaymentInput[];
};

export function useCreateSale() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutInput) =>
      unwrap<SaleDetailResponse>(await api.POST("/api/v1/sales", { body: input as never })),
    // Inherits retry:false from Providers. Never change that — there is no
    // idempotency key, so a retry creates a second invoice and double-deducts stock.
    onSuccess: () => invalidateFor(client, "createSale"),
  });
}

export type Receipt = Schemas["ReceiptResponse"];

export function useReceipt(saleId: number | null) {
  return useQuery({
    enabled: saleId !== null,
    queryKey: qk.sales.receipt(saleId ?? 0),
    queryFn: async () =>
      unwrap<Receipt>(
        await api.GET("/api/v1/sales/{id}/print", { params: { path: { id: saleId as number } } }),
      ),
  });
}

export type SaleListItem = Schemas["SaleListItemResponse"];

export function useSaleList(
  params: {
    page: number; pageSize?: number; search?: string;
    paymentMethod?: PaymentMethod; cashierId?: number; from?: string; to?: string;
  },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: qk.sales.list(params),
    queryFn: async () =>
      unwrapList<SaleListItem>(
        await api.GET("/api/v1/sales", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useSaleDetail(saleId: number | null) {
  return useQuery({
    enabled: saleId !== null,
    queryKey: qk.sales.detail(saleId ?? 0),
    queryFn: async () =>
      unwrap<SaleDetailResponse>(
        await api.GET("/api/v1/sales/{id}", { params: { path: { id: saleId as number } } }),
      ),
  });
}
