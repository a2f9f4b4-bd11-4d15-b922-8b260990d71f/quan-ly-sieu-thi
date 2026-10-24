/**
 * Runs in the browser before the app renders.
 *
 * This is the only place msw/browser may be imported: its export map is
 * `{ node: null }`, so any module the server bundle touches cannot resolve it.
 * Starting here also removes the ordering hazard — the worker is listening
 * before the first component mounts, so no request escapes to the network.
 */
if (process.env.NEXT_PUBLIC_API_MODE === "mock") {
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
}

export {};
