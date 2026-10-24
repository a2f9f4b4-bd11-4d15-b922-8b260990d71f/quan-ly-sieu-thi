import type { ErrorCode } from "./types";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const GENERIC_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại.";

function readEnvelope(body: unknown): { code?: string; message?: string; details?: unknown } | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;
  return error as { code?: string; message?: string; details?: unknown };
}

/**
 * Turns any failed response into a typed AppError.
 * UI logic must branch on `code` — never on `message`.
 */
export function normalizeError(status: number, body: unknown): AppError {
  const envelope = readEnvelope(body);

  if (envelope?.code) {
    return new AppError(
      envelope.code as ErrorCode,
      envelope.message ?? GENERIC_MESSAGE,
      status,
      envelope.details,
    );
  }

  if (status === 0) {
    return new AppError("SERVICE_UNAVAILABLE", "Không kết nối được máy chủ.", 0);
  }

  return new AppError("INTERNAL_ERROR", GENERIC_MESSAGE, status);
}

export function isCode(error: unknown, code: ErrorCode): error is AppError {
  return error instanceof AppError && error.code === code;
}
