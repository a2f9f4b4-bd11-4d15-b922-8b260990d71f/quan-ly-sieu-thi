"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Barcode guns are keyboard-wedge devices: a burst of keystrokes then Enter.
 * Focus returns here after clicks on dead space so scanning keeps working,
 * but never steals focus from another field the operator is typing in.
 */
export function ScannerInput({
  onScan,
  disabled,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    function refocus(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, button, [role=dialog]")) return;
      inputRef.current?.focus();
    }
    document.addEventListener("click", refocus);
    inputRef.current?.focus();
    return () => document.removeEventListener("click", refocus);
  }, []);

  return (
    <input
      ref={inputRef}
      aria-label="Quét mã vạch hoặc nhập SKU"
      placeholder="Quét mã vạch hoặc nhập SKU rồi nhấn Enter"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const code = value.trim();
        setValue("");
        if (code) onScan(code);
      }}
      className="w-full rounded-md border px-4 py-3 text-lg"
    />
  );
}
