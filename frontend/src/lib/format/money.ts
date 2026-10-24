const formatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

/** Formats a VND amount for display. Always use this — never render a raw number. */
export function formatVnd(amount: number): string {
  return `${formatter.format(Math.round(amount))} đ`;
}
