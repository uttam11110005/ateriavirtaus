"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/types";

/* ---------------- Demo role (PRD §9.1: demo role switch instead of auth) ---------------- */

interface Session {
  role: Role | null;
  locationId: string;
  ready: boolean;
  setRole: (r: Role | null) => void;
  setLocationId: (id: string) => void;
}

const SessionCtx = createContext<Session | null>(null);
const KEY = "ateriavirtaus.session";

let currentRole: Role | null = null;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [locationId, setLocState] = useState("harju");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (s.role) setRoleState(s.role);
      if (s.locationId) setLocState(s.locationId);
      currentRole = s.role ?? null;
    } catch {
      /* storage unavailable — stay in memory */
    }
    setReady(true);
  }, []);

  const persist = (next: { role: Role | null; locationId: string }) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setRole = useCallback(
    (r: Role | null) => {
      currentRole = r;
      setRoleState(r);
      persist({ role: r, locationId });
    },
    [locationId],
  );
  const setLocationId = useCallback(
    (id: string) => {
      setLocState(id);
      persist({ role, locationId: id });
    },
    [role],
  );

  currentRole = role;

  return (
    <SessionCtx.Provider value={{ role, locationId, ready, setRole, setLocationId }}>
      <ToastProvider>{children}</ToastProvider>
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("SessionProvider missing");
  return s;
}

/* ---------------- Data fetching ---------------- */

export class ClientApiError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-demo-role": currentRole ?? "" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientApiError(data.error ?? "Request failed.", data.field);
  notifyDataChanged();
  return data as T;
}

const listeners = new Set<() => void>();
function notifyDataChanged() {
  listeners.forEach((l) => l());
}

export function useApi<T>(url: string | null, { poll }: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const res = await fetch(u, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load data.");
      if (urlRef.current === u) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [url, load]);

  useEffect(() => {
    listeners.add(load);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    let t: ReturnType<typeof setInterval> | undefined;
    if (poll) {
      t = setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, poll);
    }
    return () => {
      listeners.delete(load);
      window.removeEventListener("focus", onFocus);
      if (t) clearInterval(t);
    };
  }, [load, poll]);

  return { data, error, loading, reload: load };
}

/* ---------------- Toasts ---------------- */

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "ok" | "bad";
}
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pop-in pointer-events-auto w-full max-w-sm rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white shadow-[0_16px_40px_-16px_rgba(28,27,25,0.5)]"
          >
            <div className="flex items-center gap-2 font-medium">
              <span className={`h-2 w-2 rounded-full ${t.tone === "ok" ? "bg-emerald-400" : "bg-red-400"}`} aria-hidden />
              {t.title}
            </div>
            {t.body && <p className="mt-0.5 pl-4 text-white/70">{t.body}</p>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
