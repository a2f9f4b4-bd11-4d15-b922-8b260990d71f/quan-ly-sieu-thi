"use client";

import { DevToolbar } from "@/mocks/DevToolbar";

/**
 * The worker itself is started in instrumentation-client.ts, before render.
 * This only adds the mock-mode dev toolbar.
 */
export function MockProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DevToolbar />
    </>
  );
}
