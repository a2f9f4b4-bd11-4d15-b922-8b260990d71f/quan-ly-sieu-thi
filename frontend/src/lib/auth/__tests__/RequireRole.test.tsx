import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RequireRole } from "../RequireRole";
import * as auth from "../context";
import type { Role } from "@/lib/api/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mockUser(role: Role) {
  vi.spyOn(auth, "useAuth").mockReturnValue({
    user: { id: 1, username: "u", fullName: "U", role },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

describe("RequireRole", () => {
  it("renders children when the role has the capability", () => {
    mockUser("ADMIN");
    render(<RequireRole capability="viewRevenueReports"><p>Báo cáo doanh thu</p></RequireRole>);
    expect(screen.getByText("Báo cáo doanh thu")).toBeInTheDocument();
  });

  it("renders the Vietnamese denial state instead of crashing when the role lacks it", () => {
    mockUser("CASHIER");
    render(<RequireRole capability="viewRevenueReports"><p>Báo cáo doanh thu</p></RequireRole>);

    expect(screen.queryByText("Báo cáo doanh thu")).not.toBeInTheDocument();
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
  });

  it("denies a stockkeeper the POS screen", () => {
    mockUser("STOCKKEEPER");
    render(<RequireRole capability="sell"><p>Màn hình bán hàng</p></RequireRole>);
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
  });
});
