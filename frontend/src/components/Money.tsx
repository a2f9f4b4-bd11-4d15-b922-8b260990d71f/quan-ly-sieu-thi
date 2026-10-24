import { formatVnd } from "@/lib/format/money";

export function Money({ value }: { value: number }) {
  return <span className="tabular-nums">{formatVnd(value)}</span>;
}
