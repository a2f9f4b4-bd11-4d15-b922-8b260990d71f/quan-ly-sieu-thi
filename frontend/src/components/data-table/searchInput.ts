export const SEARCH_MAX = 100;
export const DOCUMENT_SEARCH_MAX = 30;

/**
 * The contract caps search at 100 characters (30 for document numbers) and
 * ignores whitespace-only input. Sending raw input produces spurious 400s.
 * Returns undefined when no search parameter should be sent at all.
 */
export function normalizeSearch(raw: string, maxLength: number = SEARCH_MAX): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, maxLength);
}
