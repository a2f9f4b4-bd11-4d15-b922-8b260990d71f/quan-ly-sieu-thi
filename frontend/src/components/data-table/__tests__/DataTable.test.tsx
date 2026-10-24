import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";
import { AppError } from "@/lib/api/errors";

afterEach(cleanup);

type Row = { id: number; name: string };
const columns: Column<Row>[] = [{ key: "name", header: "Tên", render: (r) => r.name }];

function makeQuery(overrides: Record<string, unknown>) {
  return { data: undefined, isLoading: false, error: null, ...overrides } as never;
}

const base = {
  columns, search: "", onSearchChange: vi.fn(), page: 1, onPageChange: vi.fn(),
};

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable {...base} query={makeQuery({
      data: { items: [{ id: 1, name: "Coca" }], meta: { page: 1, pageSize: 20, total: 1 } },
    })} />);
    expect(screen.getByText("Coca")).toBeInTheDocument();
  });

  it("renders the Vietnamese empty state rather than an empty table", () => {
    render(<DataTable {...base} emptyMessage="Chưa có sản phẩm" query={makeQuery({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0 } },
    })} />);
    expect(screen.getByText("Chưa có sản phẩm")).toBeInTheDocument();
  });

  it("renders the permission state on 403 instead of crashing", () => {
    render(<DataTable {...base} query={makeQuery({
      error: new AppError("FORBIDDEN", "Không có quyền", 403),
    })} />);
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
  });

  it("renders a recoverable error state for a non-403 failure", () => {
    render(<DataTable {...base} query={makeQuery({
      error: new AppError("SERVICE_UNAVAILABLE", "Máy chủ bận", 503),
    })} />);
    expect(screen.getByText("Không tải được dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("Máy chủ bận")).toBeInTheDocument();
  });

  it("caps the search box at the contract limit", () => {
    render(<DataTable {...base} query={makeQuery({ isLoading: true })} />);
    expect(screen.getByLabelText("Tìm kiếm")).toHaveAttribute("maxlength", "100");
  });

  it("caps the search box at 30 for document-number searches", () => {
    render(<DataTable {...base} searchMaxLength={30} query={makeQuery({ isLoading: true })} />);
    expect(screen.getByLabelText("Tìm kiếm")).toHaveAttribute("maxlength", "30");
  });

  it("hides pagination when everything fits on one page", () => {
    render(<DataTable {...base} query={makeQuery({
      data: { items: [{ id: 1, name: "Coca" }], meta: { page: 1, pageSize: 20, total: 1 } },
    })} />);
    expect(screen.queryByRole("button", { name: "Sau" })).not.toBeInTheDocument();
  });

  it("shows pagination and the record count when there is more than one page", () => {
    render(<DataTable {...base} query={makeQuery({
      data: { items: [{ id: 1, name: "Coca" }], meta: { page: 1, pageSize: 20, total: 45 } },
    })} />);
    expect(screen.getByText("Trang 1 / 3 — 45 bản ghi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sau" })).toBeEnabled();
  });
});
