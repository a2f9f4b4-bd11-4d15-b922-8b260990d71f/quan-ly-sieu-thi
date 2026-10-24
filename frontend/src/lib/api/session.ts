import { AppError } from "./errors";
import type { SessionUserResponse } from "./types";

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: SessionUserResponse;
};

const STORAGE_KEY = "mini-store.session";

let current: Session | null = null;
let inFlight: Promise<Session> | null = null;
const listeners = new Set<(s: Session | null) => void>();

function notify() {
  for (const fn of listeners) fn(current);
}

export function getSession(): Session | null {
  if (current) return current;
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    current = JSON.parse(raw) as Session;
    return current;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setSession(session: Session): void {
  current = session;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  notify();
}

export function clearSession(): void {
  current = null;
  inFlight = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  notify();
}

export function subscribeToSession(fn: (s: Session | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Runs at most one refresh at a time.
 *
 * The API's refresh token is single-use with reuse detection: two concurrent
 * /auth/refresh calls look like a stolen token and revoke the whole session.
 * Every caller that arrives while a refresh is running awaits the same promise.
 *
 * On failure this rethrows and releases the gate but does NOT clear the session:
 * only the caller can tell a rejected token (session really is gone) from a
 * transient 500 or network blip (session is still good).
 */
export function refreshOnce(
  refreshFn: (refreshToken: string) => Promise<Session>,
): Promise<Session> {
  if (inFlight) return inFlight;

  const session = getSession();
  if (!session) {
    return Promise.reject(
      new AppError("UNAUTHENTICATED", "Phiên đăng nhập đã kết thúc.", 401),
    );
  }

  const pending = refreshFn(session.refreshToken)
    .then((next) => {
      setSession(next);
      return next;
    })
    .finally(() => {
      // Only release the gate if it is still ours: clearSession() may have
      // already nulled it, and a later refresh must not be cancelled by us.
      if (inFlight === pending) inFlight = null;
    });

  inFlight = pending;
  return pending;
}
