"use client";

import { useEffect, useState } from "react";
import { normalizeSearch, SEARCH_MAX } from "./searchInput";

/** Spec §4.5 requires debounced search; the API is also rate limited. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Holds the search box text and page, exposing the normalized search for the
 * request. The text updates immediately so typing stays responsive, while
 * `searchParam` settles only after the debounce window — otherwise every
 * keystroke is a request, and nine of them can trip a 429.
 */
export function useListState(searchMaxLength: number = SEARCH_MAX) {
  const [search, setSearchRaw] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  function setSearch(value: string) {
    setSearchRaw(value);
    setPage(1); // a new search always restarts paging
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    searchParam: normalizeSearch(debounced, searchMaxLength),
  };
}
