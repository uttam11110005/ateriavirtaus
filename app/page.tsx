"use client";

import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  CookingPot,
  Gear,
  Megaphone,
  Scales,
  Student,
  Target,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, ROLE_META } from "@/components/app-shell";
import { HowItReducesWaste } from "@/components/how-it-works";
import { useApi, useSession } from "@/components/providers";
import { cx } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import type { KitchenSnapshot, Role } from "@/lib/types";

export default function Landing() {
  const { setRole } = useSession();
  const router = useRouter();
  const { data } = useApi<KitchenSnapshot>("/api/production/recommendation");

  const enter = (r: Role) => {
    setRole(r);
    router.push(ROLE_META[r].home);
  };
  const reported = data ? data.counts.confirmed + data.counts.changed + data.counts.late : null;

  return (
    <main className="min-h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col gap-10 px-4 py-6 sm:px-6 md:py-8 lg:px-10">
        <header className="rise flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-1">
            <a href="#how" className="press hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-block">
              How it reduces waste
            </a>
            <Link href="/guide" className="press rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">
              Demo guide
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
          {/* ---------- left: pitch + simulator ---------- */}
          <section className="flex flex-col gap-7">
            <div className="flex flex-col gap-4">
              <h1
                className="rise max-w-[16ch] text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-ink md:text-[52px]"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                Cook for the diners who actually come.
              </h1>
              <p className="rise max-w-[46ch] text-base leading-relaxed text-ink-2" style={{ "--i": 2 } as React.CSSProperties}>
                Earlier meal counts → less guesswork → less food left over.
              </p>
            </div>
            <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
              <WasteSimulator />
            </div>
          </section>

          {/* ---------- right: roles ---------- */}
          <section aria-labelledby="roles" className="flex flex-col gap-4">
            <div className="rise flex items-baseline justify-between" style={{ "--i": 2 } as React.CSSProperties}>
              <h2 id="roles" className="text-lg font-semibold tracking-tight text-ink">
                Step in as
              </h2>
              <span className="text-[13px] text-ink-3">no sign-in</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <RoleTile i={3} role="location" title="School" line="Confirm tomorrow's count" onPick={enter} art={<SchoolArt />} />
              <RoleTile i={4} role="kitchen" title="Kitchen" line="Review, approve, record" onPick={enter} art={<KitchenArt />} />
              <RoleTile i={5} role="manager" title="Manager" line="Find where surplus comes from" onPick={enter} art={<ManagerArt />} />
              <RoleTile i={6} role="admin" title="Demo admin" line="Deadlines, buffer, reset" onPick={enter} art={<AdminArt />} />
            </div>
            <LoopStrip
              onGo={(r, href) => {
                setRole(r);
                router.push(href);
              }}
            />
          </section>
        </div>

        <HowItReducesWaste />

        <footer className="rise flex flex-col gap-2 border-t border-line pt-4 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between" style={{ "--i": 7 } as React.CSSProperties}>
          {data ? (
            <span className="flex items-center gap-2 text-ink-2">
              <span className="live-dot h-2 w-2 rounded-full bg-accent text-accent" aria-hidden />
              Planning {fmtDate(data.serviceDate, true)} ·{" "}
              <span className="num font-medium text-ink">
                {reported}/{data.rows.length}
              </span>
              reported
              {data.counts.missing > 0 && <span className="font-medium text-bad">· {data.counts.missing} missing</span>}
            </span>
          ) : (
            <span className="skeleton h-5 w-64" />
          )}
          <span>Synthetic data · fictional locations · not connected to Servica systems</span>
        </footer>
      </div>
    </main>
  );
}

/* ================= Late-count comparison ================= */

const CAPACITY = 300;
const USUAL_ABSENCES = 12; // what the kitchen assumes when no count arrives
const BUFFER = 0.02;
const MAX_ABSENCES = 60;
const AXIS = { min: 230, max: 310 };
const TICKS = [240, 260, 280, 300];

function scenario(absences: number, confirmed: boolean) {
  const diners = CAPACITY - absences;
  const cooked = Math.round((confirmed ? diners : CAPACITY - USUAL_ABSENCES) * (1 + BUFFER));
  return { diners, cooked, leftover: Math.max(0, cooked - diners), short: Math.max(0, diners - cooked) };
}

const pos = (n: number) => ((Math.min(AXIS.max, Math.max(AXIS.min, n)) - AXIS.min) / (AXIS.max - AXIS.min)) * 100;

function WasteSimulator() {
  const [absences, setAbsences] = useState(25);
  const onTime = scenario(absences, true);
  const late = scenario(absences, false);
  const diff = late.leftover - onTime.leftover;
  const pct = (absences / MAX_ABSENCES) * 100;

  return (
    <section className="card overflow-hidden" aria-labelledby="sim-title">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div>
          <h2 id="sim-title" className="text-[15px] font-semibold tracking-tight text-ink">
            What a late count costs
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">One school · 300 pupils · one lunch</p>
        </div>
        <span className="rounded-md bg-sunken px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Example
        </span>
      </div>

      {/* control */}
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="abs" className="text-[13px] font-medium text-ink-2">
            Pupils absent today
          </label>
          <span className="num text-[15px] font-semibold text-ink">{absences}</span>
        </div>
        <div className="relative mt-3">
          <input
            id="abs"
            type="range"
            min={0}
            max={MAX_ABSENCES}
            value={absences}
            onChange={(e) => setAbsences(Number(e.target.value))}
            className="range"
            style={{ "--p": `${pct}%` } as React.CSSProperties}
            aria-valuetext={`${absences} pupils absent`}
          />
          <div className="pointer-events-none relative mt-1.5 h-4 text-[11px] text-ink-3">
            <span className="absolute -translate-x-1/2" style={{ left: `calc(10px + (100% - 20px) * ${USUAL_ABSENCES / MAX_ABSENCES})` }}>
              <span className="mx-auto mb-0.5 block h-1.5 w-px bg-line-strong" />
              usual
            </span>
          </div>
        </div>
      </div>

      {/* comparison */}
      <div className="mt-4 border-t border-line px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5">
          <Scenario
            title="Count confirmed before the deadline"
            meta={`Cooks for ${onTime.diners} + ${Math.round(BUFFER * 100)} % buffer`}
            s={onTime}
          />
          <Scenario
            title="No count — kitchen estimates"
            meta={`Cooks for the usual ${CAPACITY - USUAL_ABSENCES} + ${Math.round(BUFFER * 100)} % buffer`}
            s={late}
          />
        </div>

        {/* axis */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_88px] sm:gap-4">
          <div className="relative h-4 text-[11px] text-ink-3">
            {TICKS.map((t) => (
              <span key={t} className="num absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-series-served" /> pupils eating
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-series-surplus bg-surface" /> meals cooked
          </span>
        </div>
      </div>

      {/* takeaway */}
      <div className="flex items-center gap-4 border-t border-line bg-canvas/60 px-5 py-4 sm:px-6">
        <div className="num w-16 shrink-0 text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink">
          {diff > 0 ? diff : late.short > 0 ? late.short : "≈0"}
        </div>
        <p className="text-[13px] leading-snug text-ink-2">
          {diff > 0 ? (
            <>
              <span className="font-medium text-ink">fewer meals left over</span> when the count arrives on time —
              about {(diff * 0.32).toFixed(1)} kg of food, from one school on one day.
            </>
          ) : late.short > 0 ? (
            <>
              <span className="font-medium text-ink">pupils without a meal</span> on a quiet day — which is why kitchens
              add large safety buffers when counts are uncertain.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">difference on a typical day</span> — the estimate is close. The
              waste comes from the days it isn&apos;t: move the slider.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function Scenario({
  title,
  meta,
  s,
}: {
  title: string;
  meta: string;
  s: ReturnType<typeof scenario>;
}) {
  const a = pos(Math.min(s.diners, s.cooked));
  const b = pos(Math.max(s.diners, s.cooked));
  const isShort = s.short > 0;
  const move = "transition-transform duration-[260ms] ease-[var(--ease-out)]";

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px] sm:items-end sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 sm:block">
          <div className="text-[13px] font-medium text-ink">{title}</div>
          <div className={cx("num shrink-0 whitespace-nowrap text-[13px] font-semibold sm:hidden", isShort ? "text-bad" : "text-ink")}>
            {isShort ? `${s.short} short` : `${s.leftover} left over`}
          </div>
        </div>
        <div className="text-[12px] text-ink-3">{meta}</div>
        {/* track */}
        <div className="relative mt-3 h-4" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
          {TICKS.map((t) => (
            <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-line" style={{ left: `${pos(t)}%` }} />
          ))}
          {/* gap segment */}
          <div
            className={cx(
              "absolute inset-x-0 top-1/2 h-1 origin-left -translate-y-1/2 rounded-full",
              move,
              isShort ? "bg-bad/70" : "bg-series-surplus",
            )}
            style={{ transform: `translateX(${a}%) scaleX(${Math.max(0.001, (b - a) / 100)})` }}
          />
          {/* eating */}
          <div className={cx("absolute inset-0", move)} style={{ transform: `translateX(${pos(s.diners)}%)` }}>
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series-served ring-2 ring-surface" />
          </div>
          {/* cooked */}
          <div className={cx("absolute inset-0", move)} style={{ transform: `translateX(${pos(s.cooked)}%)` }}>
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-series-surplus bg-surface" />
          </div>
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <div className={cx("num text-lg font-semibold leading-none", isShort ? "text-bad" : "text-ink")}>
          {isShort ? s.short : s.leftover}
        </div>
        <div className="mt-1 text-[11px] text-ink-3">{isShort ? "short" : "left over"}</div>
      </div>
    </div>
  );
}

/* ================= Role tiles with mini illustrations ================= */

function RoleTile({
  role,
  title,
  line,
  art,
  onPick,
  i,
}: {
  role: Role;
  title: string;
  line: string;
  art: React.ReactNode;
  onPick: (r: Role) => void;
  i: number;
}) {
  return (
    <button
      onClick={() => onPick(role)}
      className="rise group card press flex cursor-pointer flex-col overflow-hidden text-left [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_18px_40px_-22px_rgba(60,52,40,0.35)]"
      style={{ "--i": i } as React.CSSProperties}
    >
      <div className="relative h-28 overflow-hidden border-b border-line bg-canvas/70 sm:h-32">{art}</div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{title}</div>
          <div className="text-[13px] leading-snug text-ink-3">{line}</div>
        </div>
        <ArrowRight
          size={16}
          className="shrink-0 text-ink-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </div>
    </button>
  );
}

const lift = "transition-transform duration-300 ease-[var(--ease-out)]";

function SchoolArt() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className={cx(lift, "w-[62%] max-w-[150px] rounded-[14px] border border-line bg-surface p-2.5 shadow-sm group-hover:-translate-y-1")}>
        <div className="flex items-center gap-1 text-[9px] font-medium text-ink-3">
          <Student size={11} weight="bold" /> Diners tomorrow
        </div>
        <div className="num mt-0.5 text-2xl font-semibold leading-none text-ink">275</div>
        <div className="mt-2 flex items-center justify-center gap-1 rounded-md bg-accent py-1 text-[9px] font-medium text-white">
          <CheckCircle size={10} weight="bold" /> Confirm
        </div>
      </div>
      <span
        className={cx(
          lift,
          "absolute right-[16%] top-[18%] grid h-6 w-6 scale-75 place-items-center rounded-full bg-ok text-white opacity-0 group-hover:scale-100 group-hover:opacity-100",
        )}
      >
        <CheckCircle size={14} weight="bold" />
      </span>
    </div>
  );
}

function KitchenArt() {
  const rows = [
    { w: "72%", c: "bg-ok" },
    { w: "86%", c: "bg-ok" },
    { w: "58%", c: "bg-info" },
    { w: "64%", c: "bg-bad" },
  ];
  return (
    <div className="absolute inset-0 flex items-center gap-3 px-4">
      <div className="flex flex-1 flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", r.c)} />
            <span
              className={cx(lift, "h-1.5 origin-left rounded-full bg-line-strong group-hover:scale-x-110")}
              style={{ width: r.w, transitionDelay: `${i * 30}ms` }}
            />
          </div>
        ))}
      </div>
      <div className={cx(lift, "rounded-xl border border-line bg-surface px-2.5 py-2 text-center shadow-sm group-hover:-translate-y-1")}>
        <CookingPot size={16} weight="duotone" className="mx-auto text-accent" />
        <div className="num mt-0.5 text-lg font-semibold leading-none text-ink">1409</div>
        <div className="text-[9px] text-ink-3">approve</div>
      </div>
    </div>
  );
}

function ManagerArt() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-4">
      <svg viewBox="0 0 160 60" className="h-[70%] w-full" aria-hidden>
        <polyline
          points="0,30 20,26 40,32 60,22 80,28 100,18 120,26 140,20 160,24"
          fill="none"
          stroke="var(--color-series-forecast)"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <polyline
          className={cx(lift, "group-hover:-translate-y-[3px]")}
          points="0,36 20,31 40,40 60,27 80,38 100,24 120,35 140,27 160,31"
          fill="none"
          stroke="var(--color-series-served)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex gap-1.5">
        {[70, 45, 30, 18].map((w, i) => (
          <span key={i} className="h-1.5 rounded-full bg-series-surplus" style={{ width: `${w / 2}%`, opacity: 1 - i * 0.18 }} />
        ))}
      </div>
      <ChartLineUp size={16} className={cx(lift, "absolute right-3 top-3 text-accent group-hover:-translate-y-0.5")} weight="bold" />
    </div>
  );
}

function AdminArt() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
      <div className="num rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink shadow-sm">11:15</div>
      <div className="flex flex-col gap-2">
        {[true, false, true].map((on, i) => (
          <span
            key={i}
            className={cx("relative h-3.5 w-7 rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-line-strong", "group-hover:bg-accent")}
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            <span
              className={cx(
                "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform duration-200 ease-[var(--ease-out)]",
                on ? "translate-x-[15px]" : "translate-x-0.5",
                "group-hover:translate-x-[15px]",
              )}
              style={{ transitionDelay: `${i * 40}ms` }}
            />
          </span>
        ))}
      </div>
      <Gear size={22} weight="duotone" className="text-ink-3 transition-transform duration-500 ease-out group-hover:rotate-90" />
    </div>
  );
}

/* ================= Product loop — each step opens its screen ================= */

const LOOP: {
  Icon: typeof Target;
  label: string;
  who: string;
  role: Role;
  href: string;
  line: string;
  cta: string;
}[] = [
  {
    Icon: Target,
    label: "Predict",
    who: "Kitchen",
    role: "kitchen",
    href: "/kitchen/production",
    line: "Counts and recent history become an expected number of diners, with every input shown.",
    cta: "See the forecast",
  },
  {
    Icon: Megaphone,
    label: "Communicate",
    who: "School / day-care",
    role: "location",
    href: "/location",
    line: "Schools confirm who will eat before 22:00 — up to 7 days ahead.",
    cta: "Confirm a count",
  },
  {
    Icon: CookingPot,
    label: "Produce",
    who: "Kitchen",
    role: "kitchen",
    href: "/kitchen",
    line: "The kitchen reviews every location and approves — or adjusts — the quantity.",
    cta: "Review and approve",
  },
  {
    Icon: Scales,
    label: "Measure",
    who: "Kitchen",
    role: "kitchen",
    href: "/kitchen/actuals",
    line: "After lunch: meals cooked, eaten and left over, and kilos of food waste.",
    cta: "Record results",
  },
  {
    Icon: ChartLineUp,
    label: "Learn",
    who: "Manager",
    role: "manager",
    href: "/manager",
    line: "Find which sites and causes create surplus, and fix the process behind them.",
    cta: "Open analytics",
  },
];

function LoopStrip({ onGo }: { onGo: (role: Role, href: string) => void }) {
  const [active, setActive] = useState(1);
  const step = LOOP[active];
  return (
    <div className="rise card overflow-hidden" style={{ "--i": 7 } as React.CSSProperties}>
      <div className="flex items-baseline justify-between px-4 pt-3.5">
        <span className="text-[13px] font-medium text-ink">How a day flows</span>
        <span className="text-[12px] text-ink-3">Pick a step</span>
      </div>
      <ol className="relative mt-3 flex items-start justify-between px-4" aria-label="Product loop" role="tablist">
        <span aria-hidden className="absolute left-[calc(10%+6px)] right-[calc(10%+6px)] top-5 h-px bg-line-strong" />
        <span
          aria-hidden
          className="absolute left-[calc(10%+6px)] top-5 h-px origin-left bg-accent transition-transform duration-300 ease-[var(--ease-out)]"
          style={{ width: "calc(80% - 12px)", transform: `scaleX(${active / (LOOP.length - 1)})` }}
        />
        {LOOP.map(({ Icon, label }, i) => (
          <li key={label} className="relative z-10 flex w-1/5 flex-col items-center">
            <button
              role="tab"
              aria-label={label}
              aria-selected={active === i}
              aria-controls="loop-panel"
              onClick={() => setActive(i)}
              className={cx(
                "press grid h-10 w-10 cursor-pointer place-items-center rounded-full border transition-[background-color,border-color,color,box-shadow] duration-200",
                i === active
                  ? "border-accent bg-accent text-white shadow-[0_0_0_4px_var(--color-accent-soft)]"
                  : i < active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line-strong bg-surface text-ink-3 hover:border-ink-3 hover:text-ink",
              )}
            >
              <Icon size={18} weight={i === active ? "fill" : "regular"} />
            </button>
            <span className={cx("mt-1.5 text-[11px] font-medium sm:text-xs", i === active ? "text-ink" : "text-ink-3")}>{label}</span>
          </li>
        ))}
      </ol>
      <div
        id="loop-panel"
        role="tabpanel"
        key={active}
        className="fade-in mt-3 flex flex-col gap-3 border-t border-line bg-canvas/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
            Step {active + 1} · {step.who}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{step.line}</p>
        </div>
        <button
          onClick={() => onGo(step.role, step.href)}
          className="press group inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {step.cta}
          <ArrowRight size={14} className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
