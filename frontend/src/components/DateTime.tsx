import { formatStoreDate, formatStoreDateTime } from "@/lib/format/datetime";

/** Server timestamps are UTC; this is the only place they become store time. */
export function DateTime({ value, withTime = true }: { value: string; withTime?: boolean }) {
  return (
    <time dateTime={value} className="tabular-nums">
      {withTime ? formatStoreDateTime(value) : formatStoreDate(value)}
    </time>
  );
}
