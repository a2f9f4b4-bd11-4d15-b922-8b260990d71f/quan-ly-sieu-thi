"use client";

import dynamic from "next/dynamic";

// ssr:false keeps MswBootstrap — and therefore msw/browser — out of the
// server bundle entirely.
const MswBootstrap = dynamic(() => import("@/mocks/MswBootstrap"), { ssr: false });

export function MockProvider({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_API_MODE !== "mock") return <>{children}</>;
  return <MswBootstrap>{children}</MswBootstrap>;
}
