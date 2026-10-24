import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSession, setSession, clearSession, refreshOnce } from "../session";
import type { SessionUserResponse } from "../types";

const user: SessionUserResponse = {
  id: 1,
  username: "admin",
  fullName: "Quản lý",
  role: "ADMIN",
};

const session = { accessToken: "a1", refreshToken: "r1", user };

beforeEach(() => {
  clearSession();
});

describe("session storage", () => {
  it("stores and returns the current session", () => {
    setSession(session);
    expect(getSession()?.accessToken).toBe("a1");
  });

  it("returns null after clearing", () => {
    setSession(session);
    clearSession();
    expect(getSession()).toBeNull();
  });
});

describe("refreshOnce", () => {
  it("issues exactly one refresh when many callers race", async () => {
    setSession(session);

    const refreshFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { accessToken: "a2", refreshToken: "r2", user };
    });

    const results = await Promise.all([
      refreshOnce(refreshFn),
      refreshOnce(refreshFn),
      refreshOnce(refreshFn),
      refreshOnce(refreshFn),
    ]);

    // The whole point: the API revokes the session if a refresh token is replayed.
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.accessToken === "a2")).toBe(true);
    expect(getSession()?.accessToken).toBe("a2");
  });

  it("allows a new refresh after the previous one settles", async () => {
    setSession(session);
    const refreshFn = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: "a2", refreshToken: "r2", user })
      .mockResolvedValueOnce({ accessToken: "a3", refreshToken: "r3", user });

    await refreshOnce(refreshFn);
    await refreshOnce(refreshFn);

    expect(refreshFn).toHaveBeenCalledTimes(2);
    expect(getSession()?.accessToken).toBe("a3");
  });

  it("clears the session and rethrows when refresh fails, and does not wedge the gate", async () => {
    setSession(session);
    const failing = vi.fn().mockRejectedValue(new Error("revoked"));

    await expect(refreshOnce(failing)).rejects.toThrow("revoked");
    expect(getSession()).toBeNull();

    // A later login must be able to refresh again — the in-flight promise must be released.
    setSession(session);
    const ok = vi.fn().mockResolvedValue({ accessToken: "a9", refreshToken: "r9", user });
    await refreshOnce(ok);
    expect(getSession()?.accessToken).toBe("a9");
  });

  it("rejects without calling the server when there is no session", async () => {
    const refreshFn = vi.fn();
    await expect(refreshOnce(refreshFn)).rejects.toThrow();
    expect(refreshFn).not.toHaveBeenCalled();
  });
});
