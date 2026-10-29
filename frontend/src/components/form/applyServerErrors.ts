import { AppError } from "@/lib/api/errors";

type FieldIssue = { field: string; messages: string[] };

/** Index-name suffixes the database appends; stripped before matching a column. */
const INDEX_SUFFIXES = ["_key", "_unique", "_uniq", "_idx", "_index"];

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolves a name the server reported onto a field the form actually renders.
 *
 * DUPLICATE_VALUE does not carry a form field: the backend forwards Prisma's
 * `meta.target`, which on MySQL is the violated *index* name — "customers_phone_key",
 * not "phone" (see DuplicateValueDetailsDto in the contract). Calling setError()
 * with such a name attaches the message to a field that does not exist, so nothing
 * is rendered anywhere. We therefore peel the table prefix and index suffix off and
 * match what remains against the form's own field list, longest candidate first so
 * "users_user_name_key" prefers "userName" over a bare "name".
 *
 * Returns null when nothing matches — the caller then shows a form-level banner,
 * which is always better than silence.
 */
function resolveField(reported: string, knownFields: readonly string[]): string | null {
  const byNormalized = new Map(knownFields.map((field) => [normalize(field), field]));

  const direct = byNormalized.get(normalize(reported));
  if (direct) return direct;

  let bare = reported;
  for (const suffix of INDEX_SUFFIXES) {
    if (bare.toLowerCase().endsWith(suffix)) {
      bare = bare.slice(0, -suffix.length);
      break;
    }
  }

  // Walk the underscore segments from the left, so each candidate starts on a
  // word boundary: "users_user_name" yields "users_user_name", "user_name", "name".
  const segments = bare.split("_").filter(Boolean);
  for (let start = 0; start < segments.length; start += 1) {
    const match = byNormalized.get(normalize(segments.slice(start).join("_")));
    if (match) return match;
  }

  return null;
}

/**
 * Routes a server error onto form fields where possible.
 * Returns a form-level message when the error is not attributable to a field the
 * form renders, or null when every part of it landed on a field.
 *
 * `knownFields` is required: without it an unrecognised field name cannot be told
 * apart from a real one, and the error disappears instead of being shown.
 */
export function applyServerErrors(
  error: unknown,
  setError: (field: string, e: { message: string }) => void,
  knownFields: readonly string[],
): string | null {
  if (!(error instanceof AppError)) {
    return "Đã xảy ra lỗi. Vui lòng thử lại.";
  }

  if (error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
    const issues = error.details as FieldIssue[];
    let placed = 0;
    for (const issue of issues) {
      if (!issue?.field || !issue.messages?.length) continue;
      const field = resolveField(issue.field, knownFields);
      if (!field) continue;
      setError(field, { message: issue.messages[0] });
      placed += 1;
    }
    // Only swallow the form-level message if something actually landed on a field.
    return placed > 0 ? null : error.message;
  }

  if (error.code === "DUPLICATE_VALUE") {
    const reported = (error.details as { fields?: string | string[] } | undefined)?.fields;
    const list = typeof reported === "string" ? [reported] : (reported ?? []);
    let placed = 0;
    for (const name of list) {
      const field = resolveField(name, knownFields);
      if (!field) continue;
      setError(field, { message: error.message });
      placed += 1;
    }
    if (placed > 0) return null;
  }

  return error.message;
}
