"use client";

import { AppError } from "@/lib/api/errors";

/**
 * Loading / forbidden / error states for a detail screen.
 *
 * Returns null when there is nothing to say and the caller should render its
 * content. A detail screen that only checks `isLoading || !data` shows an
 * eternal "Đang tải…" on any error, including a 403 reached by typing a URL.
 */
export function DetailState({
  isLoading,
  error,
  loadingLabel,
}: {
  isLoading: boolean;
  error: unknown;
  loadingLabel: string;
}) {
  if (error instanceof AppError && error.code === "FORBIDDEN") {
    return (
      <div className="rounded-lg border bg-white py-20 text-center" data-testid="forbidden">
        <h2 className="font-semibold">Không có quyền truy cập</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tài khoản của bạn không được phép xem nội dung này.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white py-20 text-center" data-testid="detail-error">
        <h2 className="font-semibold">Không tải được dữ liệu</h2>
        <p className="mt-1 text-sm text-slate-500">
          {error instanceof AppError ? error.message : "Vui lòng thử lại."}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">{loadingLabel}</p>;
  }

  return null;
}
