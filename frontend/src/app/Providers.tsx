"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Never retry an authorization or validation failure — only transient ones.
              if (error instanceof AppError && error.status < 500 && error.status !== 0) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            // POST /sales has no server-side idempotency key. A retry on timeout
            // creates a second invoice and deducts stock twice. Never retry mutations.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
