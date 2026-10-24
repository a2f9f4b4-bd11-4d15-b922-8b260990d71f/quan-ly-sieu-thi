import { describe, it, expect } from "vitest";
import { normalizeSearch } from "../searchInput";

describe("normalizeSearch", () => {
  it("passes an ordinary term through trimmed", () => {
    expect(normalizeSearch("  coca  ")).toBe("coca");
  });

  it("returns undefined for an empty string so no search param is sent", () => {
    expect(normalizeSearch("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only input", () => {
    expect(normalizeSearch("    ")).toBeUndefined();
  });

  it("truncates to the 100-character contract limit", () => {
    const long = "a".repeat(150);
    expect(normalizeSearch(long)).toHaveLength(100);
  });

  it("truncates to 30 characters for document-number searches", () => {
    const long = "H".repeat(60);
    expect(normalizeSearch(long, 30)).toHaveLength(30);
  });
});
