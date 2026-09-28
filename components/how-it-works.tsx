"use client";

import { ArrowDown, CheckCircle, CookingPot, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Analytics } from "@/lib/calculations";
import { useApi } from "./providers";
import { StatusBadge, cx } from "./ui";

/** Reveal once when scrolled into view — transform + opacity only. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cx(
        "transition-[opacity,transform] duration-500 ease-[var(--ease-out)] motion-reduce:transform-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const LEVERS: { title: string; body: string; cuts: string; visual: React.ReactNode }[] = [
  {
    title: "The count arrives before anyone cooks",
    body: "Each school confirms tomorrow's diners and absences on one screen, before a fixed deadline. The kitchen cooks for known diners, not for the register.",
    cuts: "Cooking for pupils who are absent",
    visual: <DeadlineVisual />,
  },
  {
    title: "Missing and late information is visible",
    body: "Every location shows a status. A missed deadline raises a warning with the contact person, so the kitchen can call — instead of padding everything “just in case”.",
    cuts: "Blanket safety buffers",
    visual: (
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status="confirmed" size="sm" />
        <StatusBadge status="changed" size="sm" />
        <StatusBadge status="late" size="sm" />
        <StatusBadge status="missing" size="sm" />
      </div>
    ),
  },
  {
    title: "A quantity the kitchen can trust",
    body: "The recommendation shows every input — absences, a learned adjustment and a small, explicit buffer. When the number is explained, a cook can accept it instead of rounding up.",
    cuts: "Overproduction from uncertainty",
    visual: <EquationVisual />,
  },
  {
    title: "Every day teaches the next",
    body: "After service the kitchen records produced, served, surplus and waste, with a reason for big gaps. Managers see which sites and causes create surplus and fix the process.",
    cuts: "The same surplus repeating every week",
    visual: <LearnVisual />,
  },
];

export function HowItReducesWaste() {
  const { data } = useApi<Analytics>("/api/analytics?days=30");
  const ins = data?.insight;

  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-t border-line pt-14 md:pt-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
          <Reveal>
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-accent">How it reduces food waste</p>
            <h2 id="how-title" className="mt-3 max-w-[18ch] text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-ink md:text-[40px]">
              Most surplus is decided before cooking starts.
            </h2>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">
              When a kitchen doesn&apos;t know how many will eat, it cooks for the register plus a safety margin. The leftovers are
              the price of that uncertainty. Ateriavirtaus removes the uncertainty earlier — it doesn&apos;t shrink portions.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <ol className="flex flex-col" aria-label="Cause and effect">
              {["Earlier, confirmed counts", "A smaller, justified buffer", "Production close to real demand", "Less food left over"].map(
                (t, i, arr) => (
                  <li key={t} className="flex flex-col items-start">
                    <span
                      className={cx(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                        i === arr.length - 1 ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-ink",
                      )}
                    >
                      {t}
                    </span>
                    {i < arr.length - 1 && <ArrowDown size={14} className="my-1 ml-4 text-ink-3" aria-hidden />}
                  </li>
                ),
              )}
            </ol>
          </Reveal>

          <Reveal delay={140}>
            <div className="card overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-line">
                <Proof
                  value={ins ? `${Math.round(ins.lateShareOfSurplus)} %` : "—"}
                  label={`of surplus comes from the ${ins ? Math.round(ins.lateShareOfRows) : "—"} % of days with a late or missing count`}
                />
                <Proof value={ins ? `${ins.ratio.toFixed(1)}×` : "—"} label="more food left over per site when the count is late" />
              </div>
              <p className="border-t border-line bg-canvas/60 px-5 py-3 text-[12px] leading-snug text-ink-3">
                From the prototype&apos;s 30 days of synthetic data. A pilot would measure this with real counts before claiming any
                saving.
              </p>
            </div>
          </Reveal>
        </div>

        <ol className="flex flex-col">
          {LEVERS.map((l, i) => (
            <li key={l.title}>
              <Reveal delay={i * 60} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 sm:gap-5">
                <div className="flex flex-col items-center">
                  <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink">
                    {i + 1}
                  </span>
                  {i < LEVERS.length - 1 && <span className="w-px flex-1 bg-line-strong" aria-hidden />}
                </div>
                <div className={cx("min-w-0 pt-1.5", i < LEVERS.length - 1 && "pb-10")}>
                  <h3 className="text-[17px] font-semibold tracking-tight text-ink">{l.title}</h3>
                  <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{l.body}</p>
                  <div className="mt-4 flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">{l.visual}</div>
                    <div className="shrink-0 sm:max-w-[190px] sm:text-right">
                      <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Cuts</span>
                      <span className="text-[13px] text-ink">{l.cuts}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
          <li>
            <Reveal className="mt-8 flex gap-3 rounded-[14px] border border-accent/15 bg-accent-soft px-4 py-3.5 sm:ml-[60px]">
              <ShieldCheck size={20} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-accent-ink">
                <span className="font-semibold">Service comes first.</span> The system never lowers a quantity on its own — a
                person approves every production decision, and a shortfall is shown as clearly as a surplus.
              </p>
            </Reveal>
          </li>
        </ol>
      </div>
    </section>
  );
}

function Proof({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-5 py-4">
      <div className="num text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink">{value}</div>
      <p className="mt-2 text-[13px] leading-snug text-ink-2">{label}</p>
    </div>
  );
}

function DeadlineVisual() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 font-medium text-ok">
        <CheckCircle size={13} weight="bold" /> 275 confirmed · 09:31
      </span>
      <span className="h-px w-4 bg-line-strong" aria-hidden />
      <span className="rounded-full border border-line-strong px-2 py-0.5 font-medium text-ink-2">Deadline 22:00</span>
      <span className="h-px w-4 bg-line-strong" aria-hidden />
      <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 font-medium text-ink-2">
        <CookingPot size={13} weight="bold" /> Cooking next day
      </span>
    </div>
  );
}

function EquationVisual() {
  const parts: [string, string][] = [
    ["300", "expected"],
    ["− 25", "absent"],
    ["− 5", "learned"],
    ["+ 5", "buffer"],
  ];
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      {parts.map(([n, l]) => (
        <span key={l} className="flex flex-col">
          <span className="num text-[15px] font-semibold text-ink">{n}</span>
          <span className="text-[11px] text-ink-3">{l}</span>
        </span>
      ))}
      <span className="flex flex-col">
        <span className="num text-[15px] font-semibold text-accent">= 275</span>
        <span className="text-[11px] text-ink-3">to cook</span>
      </span>
    </div>
  );
}

function LearnVisual() {
  const { data } = useApi<Analytics>("/api/analytics?days=30");
  const onTime = data?.insight.onTimeSurplus ?? 0;
  const late = data?.insight.lateSurplus ?? 0;
  const max = Math.max(1, onTime, late);
  const rows = [
    { label: "Count on time", v: onTime, cls: "bg-series-served" },
    { label: "Count late / missing", v: late, cls: "bg-series-surplus" },
  ];
  return (
    <div className="flex w-full min-w-[220px] flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[128px_1fr_36px] items-center gap-2 text-[12px]">
          <span className="text-ink-2">{r.label}</span>
          <span className="h-2 rounded-full bg-sunken">
            <span
              className={cx("block h-2 origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)]", r.cls)}
              style={{ transform: `scaleX(${data ? r.v / max : 0})` }}
            />
          </span>
          <span className="num text-right font-medium text-ink">{data ? r.v.toFixed(1) : "—"}</span>
        </div>
      ))}
      <span className="text-[11px] text-ink-3">Meals left over per site per day</span>
    </div>
  );
}
