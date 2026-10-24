import { describe, it, expect } from "vitest";

/**
 * Proves the test environment itself is wired: jsdom provides a DOM, and
 * setup.ts registered the jest-dom matchers every later test depends on.
 * Contract-type resolution is a compile-time concern and is gated by
 * `npm run typecheck`, not here — a type-only import is erased before runtime
 * and so can never fail at test time.
 */
describe("test environment", () => {
  it("provides a jsdom document", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("div").tagName).toBe("DIV");
  });

  it("registers the jest-dom matchers from setup.ts", () => {
    const el = document.createElement("span");
    el.textContent = "xin chào";
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("xin chào");
  });
});
