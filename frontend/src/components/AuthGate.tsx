"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AppNav } from "@/components/AppNav";

/** Redirects anonymous visitors to /login and renders the authenticated shell. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppNav role={user.role} />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
