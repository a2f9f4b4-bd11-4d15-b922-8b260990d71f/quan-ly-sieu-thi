import { AuthGate } from "@/components/AuthGate";

/**
 * Authentication state lives in the browser, so AuthGate renders null until the
 * session is read from localStorage. Next 16 would otherwise log an
 * instant-navigation validation warning for every segment on every request.
 * This config is only legal on a Server Component, hence the split.
 */
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
