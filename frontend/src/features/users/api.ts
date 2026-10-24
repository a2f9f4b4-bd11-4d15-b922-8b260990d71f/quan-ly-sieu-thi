"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapList, unwrapVoid } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { invalidateFor } from "@/lib/query/invalidation";
import type { Role, UserResponse } from "@/lib/api/types";

export function useUserList(params: {
  page: number; pageSize?: number; search?: string; role?: Role; isActive?: boolean;
}) {
  return useQuery({
    queryKey: qk.users.list(params),
    queryFn: async () =>
      unwrapList<UserResponse>(
        await api.GET("/api/v1/users", { params: { query: { pageSize: 20, ...params } } }),
      ),
  });
}

export function useUserMutations() {
  const client = useQueryClient();
  const done = () => invalidateFor(client, "mutateUser");

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      unwrap<UserResponse>(await api.POST("/api/v1/users", { body: body as never })),
    onSuccess: done,
  });

  const setLocked = useMutation({
    mutationFn: async ({ id, locked }: { id: number; locked: boolean }) =>
      unwrap<UserResponse>(
        locked
          ? await api.POST("/api/v1/users/{id}/lock", { params: { path: { id } } })
          : await api.POST("/api/v1/users/{id}/unlock", { params: { path: { id } } }),
      ),
    onSuccess: done,
  });

  const resetPassword = useMutation({
    // The contract names this field newPassword, and the success envelope
    // carries no data payload.
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) =>
      unwrapVoid(
        await api.POST("/api/v1/users/{id}/reset-password", {
          params: { path: { id } },
          body: { newPassword } as never,
        }),
      ),
  });

  return { create, setLocked, resetPassword };
}
