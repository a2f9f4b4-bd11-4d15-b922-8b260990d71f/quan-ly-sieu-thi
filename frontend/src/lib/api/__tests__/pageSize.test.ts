import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The API rejects pageSize > 100 with a 400. The mock's paginate() has no such cap,
 * so a request that is too large succeeds locally and returns nothing in production:
 * the purchase form asked for 200 and its product picker was silently empty, which
 * made the screen unusable against the real backend and no test noticed.
 *
 * This is a source scan rather than a runtime check because the failure is invisible
 * at runtime under the mock — which is exactly how it survived.
 */
const MAX_PAGE_SIZE = 100;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "__tests__" && entry !== "mocks") sourceFiles(path, found);
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

describe("pageSize stays within the API's limit", () => {
  it("has no request asking for more than 100 rows", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Comments discuss the limit (including the one explaining this very rule),
        // so only real code counts.
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;

        for (const match of line.matchAll(/pageSize:\s*(\d+)/g)) {
          if (Number(match[1]) > MAX_PAGE_SIZE) {
            offenders.push(`${file}:${index + 1} asks for pageSize ${match[1]}`);
          }
        }
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
