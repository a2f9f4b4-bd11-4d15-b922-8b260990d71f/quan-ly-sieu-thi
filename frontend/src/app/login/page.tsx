"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      {/*
        method="post" matters: before React hydrates there is no submit handler,
        so a click triggers a NATIVE submit. With the default GET that would put
        the username and password into the URL and browser history. POST keeps
        them in the body. Do not remove.
      */}
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
          type="submit" disabled={pending}
          className="w-full rounded-md bg-slate-900 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
