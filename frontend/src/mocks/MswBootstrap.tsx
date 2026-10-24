"use client";

import { useEffect, useState } from "react";
import { DevToolbar } from "./DevToolbar";

/**
 * Starts the MSW service worker, then renders children.
 *
 * Loaded only through next/dynamic with `ssr: false`. MSW's "./browser" export
 * is `{ node: null }`, so it cannot be resolved in Next's server bundle at all —
 * this module must never enter the server module graph.
 */
export default function MswBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("./browser").then(async ({ worker }) => {
      // Gate rendering until the worker is listening: a request that fires
      // first escapes to the real network.
      await worker.start({ onUnhandledFrame: "bypass", quiet: true });
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;

  return (
    <>
      {children}
      <DevToolbar />
    </>
  );
}
