"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Until React hydrates, no submit handler exists and a click would trigger a
  // NATIVE form GET — which puts the username and password in the URL and in
  // browser history. Keep submission disabled until the handler is attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      // One generic message for bad credentials — never reveal whether the account exists.
      setError(e instanceof AppError ? e.message : "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form method="post" onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Đăng nhập</h1>
        <p className="text-sm text-slate-500">Hệ thống quản lý siêu thị</p>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Tên đăng nhập</span>
          <input
            name="username" autoComplete="username" required value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Mật khẩu</span>
          <input
            name="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" data-testid="form-error" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit" disabled={pending || !hydrated}
          className="w-full rounded-md bg-slate-900 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
