"use client";

import { useState } from "react";
import { normalizeSearch, SEARCH_MAX } from "./searchInput";

/** Holds the search box text and page, exposing the normalized search for the request. */
export function useListState(searchMaxLength: number = SEARCH_MAX) {
  const [search, setSearchRaw] = useState("");
  const [page, setPage] = useState(1);

  function setSearch(value: string) {
    setSearchRaw(value);
    setPage(1); // a new search always restarts paging
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    searchParam: normalizeSearch(search, searchMaxLength),
  };
}
