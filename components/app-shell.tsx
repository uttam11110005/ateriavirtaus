"use client";

import { CaretDown, ClockCountdown, Check } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtTime } from "@/lib/dates";
import type { Role, Settings } from "@/lib/types";
import { apiPost, useApi, useSession, useToast } from "./providers";
import { cx } from "./ui";

export const ROLE_META: Record<Role, { label: string; home: string; person: string }> = {
  location: { label: "School / day-care", home: "/location", person: "Location contact" },
  kitchen: { label: "Kitchen", home: "/kitchen", person: "Minna Rautio" },
  manager: { label: "Manager", home: "/manager", person: "Food-service manager" },
  admin: { label: "Demo admin", home: "/settings", person: "Demo administrator" },
};

const NAV: Record<Role, { href: string; label: string }[]> = {
  location: [{ href: "/location", label: "Meal count" }],
  kitchen: [
    { href: "/kitchen", label: "Overview" },
    { href: "/kitchen/production", label: "Production" },
    { href: "/kitchen/actuals", label: "Post-service" },
  ],
  manager: [
    { href: "/manager", label: "Analytics" },
    { href: "/kitchen", label: "Kitchen view" },
    { href: "/settings", label: "Settings" },
  ],
  admin: [
    { href: "/kitchen", label: "Overview" },
    { href: "/kitchen/production", label: "Production" },
    { href: "/kitchen/actuals", label: "Post-service" },
    { href: "/manager", label: "Analytics" },
    { href: "/location", label: "Location view" },
    { href: "/settings", label: "Settings" },
  ],
};

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="8" fill="var(--color-accent)" />
        <path d="M6 12.5h14a7 7 0 0 1-14 0Z" fill="#fff" opacity=".95" />
        <path d="M8.5 8.6c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.2 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.03em] text-ink">Ateriavirtaus</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, ready } = useSession();
  const isLanding = pathname === "/";

  if (isLanding) return <>{children}</>;

  const nav = role ? NAV[role] : [];
  const active = (href: string) => (href === "/kitchen" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 rounded-lg" aria-label="Ateriavirtaus — choose role">
            <Logo />
          </Link>
          <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 xl:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cx(
                  "press whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                  active(n.href) ? "bg-surface text-ink shadow-[0_1px_2px_rgba(28,27,25,0.08)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/guide"
              aria-current={pathname === "/guide" ? "page" : undefined}
              className={cx(
                "press whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                pathname === "/guide" ? "bg-surface text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              Demo guide
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <DemoClock />
            {ready && <RoleSwitch />}
          </div>
        </div>
        {nav.length > 0 && (
          <nav aria-label="Main (mobile)" className="flex gap-1 overflow-x-auto px-4 pb-2 xl:hidden">
            {[...nav, { href: "/guide", label: "Guide" }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cx(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium",
                  active(n.href) ? "bg-surface text-ink" : "text-ink-2",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div className="border-b border-line bg-sunken/60">
        <p className="mx-auto max-w-[1400px] px-4 py-1.5 text-xs text-ink-3 sm:px-6">
          Prototype with synthetic data. Locations are fictional; no Servica systems are connected. All quantities are
          recommendations for human decision.
        </p>
      </div>
      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 md:pt-8">{children}</main>
    </div>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onOut, active]);
}

function RoleSwitch() {
  const { role, setRole } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="press flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface pl-2 pr-2.5 text-sm font-medium text-ink hover:border-line-strong"
      >
        <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-ink">
          {role ? ROLE_META[role].label.slice(0, 1) : "?"}
        </span>
        <span className="hidden sm:inline">{role ? ROLE_META[role].label : "Choose role"}</span>
        <CaretDown size={14} className="text-ink-3" />
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute right-0 top-12 z-40 w-60 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-[0_20px_40px_-18px_rgba(28,27,25,0.35)]"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-3">Switch demo role</div>
          {(Object.keys(ROLE_META) as Role[]).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={r === role}
              onClick={() => {
                setRole(r);
                setOpen(false);
                router.push(ROLE_META[r].home);
              }}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-sunken"
            >
              {ROLE_META[r].label}
              {r === role && <Check size={15} weight="bold" className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClockData {
  settings: Settings;
  now: string;
  serviceDate: string;
}

function DemoClock() {
  const { data } = useApi<ClockData>("/api/settings", { poll: 20000 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useOutside(ref, () => setOpen(false), open);
  if (!data) return <div className="skeleton hidden h-10 w-44 sm:block" />;

  const today = data.now.slice(0, 10);
  const set = async (body: Partial<Settings>, msg: string) => {
    setBusy(true);
    try {
      await apiPost("/api/settings", body);
      toast({ title: msg, tone: "ok" });
      setOpen(false);
    } catch (e) {
      toast({ title: "Could not move the clock", body: (e as Error).message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };
  const presets = [
    { t: "09:30", label: "Morning — counts coming in" },
    { t: "15:00", label: "Afternoon — deadline 22:00 still open" },
    { t: "21:45", label: "15 minutes before the deadline" },
    { t: "22:30", label: "After the deadline — missing counts show" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Demo clock"
        className="press flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-sm hover:border-line-strong"
      >
        <ClockCountdown size={17} className="text-accent" weight="duotone" />
        <span className="hidden whitespace-nowrap text-ink-3 2xl:inline">{data.settings.clockMode === "real" ? "Real time" : "Demo clock"}</span>
        <span className="num whitespace-nowrap font-medium text-ink">
          <span className="hidden sm:inline">{fmtDate(today)} </span>
          {fmtTime(data.now)}
        </span>
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-12 z-40 w-[min(340px,calc(100vw-2rem))] origin-top-right rounded-xl border border-line bg-surface p-3 shadow-[0_20px_40px_-18px_rgba(28,27,25,0.35)]">
          <p className="px-1 text-sm font-medium text-ink">Demo clock</p>
          <p className="px-1 pb-2 text-[13px] leading-snug text-ink-3">
            Move time to show how deadlines turn drafts into Missing or Late. Planning for{" "}
            <span className="font-medium text-ink-2">{fmtDate(data.serviceDate, true)}</span>.
          </p>
          <div className="flex flex-col">
            {presets.map((p) => (
              <button
                key={p.t}
                disabled={busy}
                onClick={() => set({ clockMode: "simulated", simulatedNow: `${today}T${p.t}` }, `Clock set to ${p.t}`)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-sunken"
              >
                <span className="num w-12 font-medium text-ink">{p.t}</span>
                <span className="text-ink-2">{p.label}</span>
              </button>
            ))}
            <div className="my-1.5 border-t border-line" />
            <button
              disabled={busy}
              onClick={() =>
                set({ clockMode: "simulated", simulatedNow: `${data.serviceDate}T08:00` }, "Moved to the next service day")
              }
              className="cursor-pointer rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-sunken"
            >
              Jump to next day, 08:00
              <span className="block text-[13px] text-ink-3">Service happens; a new planning day begins</span>
            </button>
            <button
              disabled={busy}
              onClick={() =>
                set(
                  { clockMode: data.settings.clockMode === "real" ? "simulated" : "real" },
                  data.settings.clockMode === "real" ? "Using the demo clock" : "Using real time",
                )
              }
              className="cursor-pointer rounded-lg px-2 py-2 text-left text-sm text-ink-2 hover:bg-sunken"
            >
              {data.settings.clockMode === "real" ? "Back to demo clock" : "Use real time instead"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
