"use client";

import { useAuth } from "./context";
import { can, type Capability } from "./permissions";

/**
 * Hides UI the current role may not use. This is UX, not security — the server
 * is the real gate, so screens must still handle a 403 from the API.
 */
export function RequireRole({
  capability,
  children,
}: {
  capability: Capability;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;

  if (!can(user.role, capability)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <h2 className="text-lg font-semibold">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500">
          Tài khoản của bạn không được phép xem nội dung này. Vui lòng liên hệ quản lý.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
