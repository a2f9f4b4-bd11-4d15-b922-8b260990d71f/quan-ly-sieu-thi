import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { ResourceForm, type FieldSpec } from "../ResourceForm";
import { AppError } from "@/lib/api/errors";

afterEach(cleanup);

const schema = z.object({
  name: z.string().min(1, "Tên là bắt buộc"),
  price: z.coerce.number().min(0, "Giá không được âm"),
});

const fields: FieldSpec[] = [
  { name: "name", label: "Tên" },
  { name: "price", label: "Giá", type: "number" },
];

function setup(overrides: Partial<React.ComponentProps<typeof ResourceForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <ResourceForm
      title="Thêm sản phẩm"
      fields={fields}
      schema={schema}
      defaultValues={{ name: "", price: 0 }}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

describe("ResourceForm", () => {
  it("renders its title and fields in Vietnamese", () => {
    setup();
    expect(screen.getByText("Thêm sản phẩm")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên")).toBeInTheDocument();
    expect(screen.getByLabelText("Giá")).toBeInTheDocument();
  });

  it("blocks submission and shows the client-side validation message", async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Tên là bắt buộc")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid values and closes", async () => {
    const { onSubmit, onClose } = setup();
    await userEvent.type(screen.getByLabelText("Tên"), "Coca");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Coca", price: 0 }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("places a server VALIDATION_ERROR on the offending field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new AppError("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 400, [
        { field: "name", messages: ["Tên đã được dùng"] },
      ]),
    );
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Tên"), "Coca");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Tên đã được dùng")).toBeInTheDocument();
  });

  it("shows a form-level banner for an error that names no field, and stays open", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new AppError("CATEGORY_INACTIVE", "Danh mục đã ngừng sử dụng.", 422),
    );
    const onClose = vi.fn();
    setup({ onSubmit, onClose });

    await userEvent.type(screen.getByLabelText("Tên"), "Coca");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByTestId("form-error")).toHaveTextContent("Danh mục đã ngừng sử dụng.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
