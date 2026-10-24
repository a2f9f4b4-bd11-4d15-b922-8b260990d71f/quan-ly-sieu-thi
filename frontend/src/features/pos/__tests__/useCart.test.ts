import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCart } from "../useCart";
import type { ProductResponse } from "@/lib/api/types";

const coca = { id: 1, sku: "COCA-330", name: "Coca-Cola lon 330ml", unit: "lon", salePrice: 12000, stockQty: 96 } as ProductResponse;
const pepsi = { id: 2, sku: "PEPSI-330", name: "Pepsi lon 330ml", unit: "lon", salePrice: 11000, stockQty: 8 } as ProductResponse;

describe("useCart", () => {
  it("adds a product as a new line", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addProduct(coca));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(1);
  });

  it("merges a repeated scan into the existing line rather than duplicating it", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.addProduct(coca); });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(3);
  });

  it("computes the subtotal across lines", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.addProduct(pepsi); });
    act(() => { result.current.setQuantity(1, 2); });
    expect(result.current.subtotal).toBe(2 * 12000 + 11000);
  });

  it("removes a line when quantity is set to zero", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.setQuantity(1, 0); });
    expect(result.current.lines).toHaveLength(0);
  });

  it("refuses a fractional quantity, since v1 sells whole units only", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.setQuantity(1, 2.5); });
    expect(result.current.lines[0].quantity).toBe(1);
  });

  it("clears every line", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.addProduct(pepsi); });
    act(() => { result.current.clear(); });
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("exposes the checkout payload the API expects", () => {
    const { result } = renderHook(() => useCart());
    act(() => { result.current.addProduct(coca); });
    act(() => { result.current.setQuantity(1, 3); });
    expect(result.current.toItems()).toEqual([{ productId: 1, quantity: 3 }]);
  });
});
