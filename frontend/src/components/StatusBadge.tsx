const LABELS: Record<string, { text: string; className: string }> = {
  DRAFT: { text: "Nháp", className: "bg-amber-100 text-amber-900" },
  RECEIVED: { text: "Đã nhận", className: "bg-green-100 text-green-900" },
  CANCELLED: { text: "Đã hủy", className: "bg-gray-200 text-gray-700" },
  PAID: { text: "Đã thanh toán", className: "bg-green-100 text-green-900" },
  ACTIVE: { text: "Đang hoạt động", className: "bg-green-100 text-green-900" },
  INACTIVE: { text: "Ngừng hoạt động", className: "bg-gray-200 text-gray-700" },
  LOW_STOCK: { text: "Sắp hết", className: "bg-red-100 text-red-900" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = LABELS[status] ?? { text: status, className: "bg-gray-100 text-gray-800" };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${entry.className}`}>
      {entry.text}
    </span>
  );
}
