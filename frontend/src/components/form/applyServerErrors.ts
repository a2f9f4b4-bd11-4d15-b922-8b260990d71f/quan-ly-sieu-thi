import { AppError } from "@/lib/api/errors";

type FieldIssue = { field: string; messages: string[] };

/**
 * Routes a server error onto form fields where possible.
 * Returns a form-level message when the error is not attributable to a field,
 * or null when every part of it was placed on a field.
 */
export function applyServerErrors(
  error: unknown,
  setError: (field: string, e: { message: string }) => void,
): string | null {
  if (!(error instanceof AppError)) {
    return "Đã xảy ra lỗi. Vui lòng thử lại.";
  }

  if (error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
    const issues = error.details as FieldIssue[];
    let placed = 0;
    for (const issue of issues) {
      if (issue?.field && issue.messages?.length) {
        setError(issue.field, { message: issue.messages[0] });
        placed += 1;
      }
    }
    // Only swallow the form-level message if something actually landed on a field.
    return placed > 0 ? null : error.message;
  }

  if (error.code === "DUPLICATE_VALUE") {
    const fields = (error.details as { fields?: string | string[] } | undefined)?.fields;
    const list = typeof fields === "string" ? [fields] : (fields ?? []);
    if (list.length > 0) {
      for (const field of list) setError(field, { message: error.message });
      return null;
    }
  }

  return error.message;
}
