"use client";

import { setForcedFailure } from "./handlers/_shared";
import { resetDb } from "./db";

const FAILURES = [
  { label: "403", status: 403, code: "FORBIDDEN", message: "Không có quyền truy cập." },
  { label: "409", status: 409, code: "TRANSACTION_CONFLICT", message: "Giao dịch bị xung đột. Vui lòng thử lại." },
  { label: "503", status: 503, code: "SERVICE_UNAVAILABLE", message: "Máy chủ tạm thời không phản hồi." },
] as const;

/** Mock-mode only. Stages error responses that are otherwise hard to reach. */
export function DevToolbar() {
  if (process.env.NEXT_PUBLIC_API_MODE !== "mock") return null;

  return (
    <div data-dev-toolbar className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs shadow-lg">
      <span className="font-medium text-slate-500">Mock</span>
      {FAILURES.map((f) => (
        <button
          key={f.label}
          onClick={() => setForcedFailure({ status: f.status, code: f.code, message: f.message })}
          className="rounded border px-2 py-1 hover:bg-slate-100"
          title={`Lần gọi API kế tiếp sẽ trả ${f.label}`}
        >
          {f.label}
        </button>
      ))}
      <button
        onClick={() => { resetDb(); window.location.reload(); }}
        className="rounded border px-2 py-1 hover:bg-slate-100"
      >
        Reset dữ liệu demo
      </button>
    </div>
  );
}
