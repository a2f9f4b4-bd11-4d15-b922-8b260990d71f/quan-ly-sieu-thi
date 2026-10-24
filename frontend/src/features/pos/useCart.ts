"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProductResponse } from "@/lib/api/types";

export type CartLine = {
  productId: number;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  availableAtScan: number;
};

export const MAX_CART_LINES = 200;

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addProduct = useCallback((product: ProductResponse, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.productId === product.id);
      if (existing) {
        return current.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      if (current.length >= MAX_CART_LINES) return current;
      return [
        ...current,
        {
          productId: product.id, sku: product.sku, name: product.name, unit: product.unit,
          unitPrice: product.salePrice, quantity, availableAtScan: product.stockQty,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    // v1 sells whole units only (BR4) — ignore anything else.
    if (!Number.isInteger(quantity)) return;
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.productId !== productId)
        : current.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
  }, []);

  const removeLine = useCallback((productId: number) => {
    setLines((current) => current.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  /** The cart sends only ids and quantities — the server prices the sale. */
  const toItems = useCallback(
    () => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    [lines],
  );

  return { lines, addProduct, setQuantity, removeLine, clear, subtotal, toItems };
}
