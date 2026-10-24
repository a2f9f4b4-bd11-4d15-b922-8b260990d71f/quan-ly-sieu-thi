import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListState } from "../useListQuery";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useListState", () => {
  it("shows typed text immediately but holds the request parameter back", () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setSearch("coca"));
    // the input must stay responsive
    expect(result.current.search).toBe("coca");
    // ...while the query parameter has not moved yet
    expect(result.current.searchParam).toBeUndefined();
  });

  it("settles on the final value after the debounce window", () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setSearch("c"));
    act(() => result.current.setSearch("co"));
    act(() => result.current.setSearch("coca"));
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.searchParam).toBe("coca");
  });

  it("still applies the contract cap to the debounced value", () => {
    const { result } = renderHook(() => useListState(30));

    act(() => result.current.setSearch("H".repeat(60)));
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.searchParam).toHaveLength(30);
  });

  it("drops whitespace-only input rather than sending it", () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setSearch("   "));
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.searchParam).toBeUndefined();
  });

  it("resets to page 1 as soon as the user types", () => {
    const { result } = renderHook(() => useListState());

    act(() => result.current.setPage(3));
    act(() => result.current.setSearch("coca"));

    expect(result.current.page).toBe(1);
  });
});
