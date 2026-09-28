"use client";

import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  Check,
  CheckCircle,
  ForkKnife,
  Info,
  PencilSimpleLine,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { apiPost, ClientApiError, useApi, useSession, useToast } from "@/components/providers";
import { Button, ErrorState, Field, inputCls, PageSkeleton, selectCls, StatusBadge, Stepper, cx } from "@/components/ui";
import { addDays, fmtDate, fmtStamp, fmtTime, parseDate, wallClock } from "@/lib/dates";
import { DIET_LABEL } from "@/lib/labels";
import type {
  ChangeLog,
  DemandStatus,
  LocationDemandView,
  MealPlan,
  ProductionPlan,
  Settings,
  SpecialCounts,
} from "@/lib/types";
import { SPECIAL_DIETS } from "@/lib/types";

interface PlanDay {
  date: string;
  status: DemandStatus;
  deadline: string;
  diners: number | null;
}

interface HistoryRow {
  date: string;
  status: DemandStatus;
  confirmed: number | null;
  ate: number;
}

interface DemandResponse {
  now: string;
  serviceDate: string;
  date: string;
  days: PlanDay[];
  meal: MealPlan | null;
  view: LocationDemandView;
  plan: ProductionPlan | null;
  history: HistoryRow[];
  log: ChangeLog[];
  settings: Settings;
}

export default function LocationPage() {
  const { locationId, setLocationId, role } = useSession();
  const [date, setDate] = useState<string | null>(null);
  const { data: locations } = useApi<LocationDemandView[]>("/api/demand");
  const { data, error, reload } = useApi<DemandResponse>(
    `/api/demand?locationId=${locationId}${date ? `&date=${date}` : ""}`,
    { poll: 15000 },
  );

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div className="rise flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-medium text-ink-3">{role === "location" ? "Your location" : "Viewing location"} (demo)</div>
        <div className="relative">
          <label htmlFor="loc" className="sr-only">
            Location
          </label>
          <select
            id="loc"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setDate(null);
            }}
            className={cx(selectCls, "appearance-none")}
          >
            {(locations ?? []).map((l) => (
              <option key={l.location.id} value={l.location.id}>
                {l.location.name}
              </option>
            ))}
            {!locations && <option value={locationId}>Loading…</option>}
          </select>
          <CaretDown size={14} className="pointer-events-none absolute right-3 top-3 text-ink-3" />
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.view.location.id !== locationId ? (
        <PageSkeleton />
      ) : (
        <>
          <DayStrip days={data.days} selected={data.date} now={data.now} onSelect={setDate} />
          <LocationDay key={`${data.view.record.id}-${data.view.record.updatedAt}`} data={data} />
        </>
      )}
    </div>
  );
}

/* ---------------- 7-day planner ---------------- */

function dayLabel(date: string, now: string) {
  const today = now.slice(0, 10);
  if (date === addDays(today, 1)) return "Tomorrow";
  const d = parseDate(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

const DOT: Record<DemandStatus, { cls: string; label: string }> = {
  confirmed: { cls: "bg-ok", label: "Confirmed" },
  changed: { cls: "bg-info", label: "Updated" },
  late: { cls: "bg-warn", label: "Sent late" },
  missing: { cls: "bg-bad", label: "Missing" },
  draft: { cls: "border border-line-strong bg-surface", label: "To do" },
};

function DayStrip({
  days,
  selected,
  now,
  onSelect,
}: {
  days: PlanDay[];
  selected: string;
  now: string;
  onSelect: (d: string) => void;
}) {
  const done = days.filter((d) => d.status !== "draft" && d.status !== "missing").length;
  return (
    <section className="rise" style={{ "--i": 1 } as React.CSSProperties} aria-label="Choose a service day">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="whitespace-nowrap text-sm font-semibold text-ink">Next 7 service days</h2>
        <span className="text-[13px] text-ink-3">
          <span className="num font-medium text-ink-2">{done}</span> of {days.length} confirmed<span className="hidden sm:inline"> · plan ahead any time</span>
        </span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ol className="grid min-w-[560px] grid-cols-7 gap-2">
          {days.map((d) => {
            const active = d.date === selected;
            const dt = parseDate(d.date);
            return (
              <li key={d.date}>
                <button
                  onClick={() => onSelect(d.date)}
                  aria-pressed={active}
                  aria-label={`${fmtDate(d.date, true)} — ${DOT[d.status].label}`}
                  className={cx(
                    "press flex w-full cursor-pointer flex-col items-start rounded-[12px] border px-3 py-2.5 text-left",
                    active
                      ? "border-ink bg-ink text-white shadow-[0_8px_20px_-12px_rgba(28,27,25,0.6)]"
                      : "border-line bg-surface text-ink hover:border-line-strong",
                  )}
                >
                  <span className={cx("text-[12px] font-medium", active ? "text-white/70" : "text-ink-3")}>{dayLabel(d.date, now)}</span>
                  <span className="num text-lg font-semibold leading-tight">{dt.getDate()}</span>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <span className={cx("h-2 w-2 rounded-full", DOT[d.status].cls)} aria-hidden />
                    <span className={cx("text-[11px]", active ? "text-white/80" : "text-ink-3")}>
                      {d.diners !== null ? <span className="num">{d.diners}</span> : DOT[d.status].label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Deadline countdown ---------------- */

/**
 * Current time, ticking every second. In real-time mode it is the device clock;
 * with the demo clock it counts on from the server's simulated "now".
 */
function useTicking(now: string, real: boolean) {
  const anchor = useRef({ server: parseDate(now).getTime(), local: Date.now() });
  const read = () => (real ? wallClock().getTime() : anchor.current.server + (Date.now() - anchor.current.local));
  const [t, setT] = useState(read);
  useEffect(() => {
    anchor.current = { server: parseDate(now).getTime(), local: Date.now() };
    setT(read());
    const id = setInterval(() => setT(read()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, real]);
  return t;
}

const pad = (n: number) => String(n).padStart(2, "0");

function DeadlineTimer({
  deadline,
  now,
  confirmed,
  real,
}: {
  deadline: string;
  now: string;
  confirmed: boolean;
  real: boolean;
}) {
  const t = useTicking(now, real);
  const msLeft = parseDate(deadline).getTime() - t;
  const passed = msLeft <= 0;
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(s / 86400);
  const clock = days > 0 ? `${days}d ${pad(Math.floor((s % 86400) / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m` : `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  // ring shows the last 24 hours before the deadline
  const frac = passed ? 0 : Math.min(1, msLeft / (24 * 3600 * 1000));
  const tone = passed ? (confirmed ? "text-ink-3" : "text-bad") : confirmed ? "text-ok" : msLeft < 30 * 60000 ? "text-bad" : msLeft < 2 * 3600000 ? "text-warn" : "text-accent";
  const sameDay = deadline.slice(0, 10) === now.slice(0, 10);
  const R = 17;
  const C = 2 * Math.PI * R;

  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-[14px] border px-3 py-2.5",
        passed && !confirmed ? "border-bad/25 bg-bad-soft" : "border-line bg-canvas/70",
      )}
      role="timer"
      aria-live="off"
      aria-label={passed ? "Deadline passed" : `Time left to confirm: ${clock}`}
    >
      <div className="relative shrink-0">
      <svg width="42" height="42" viewBox="0 0 42 42" className={cx("-rotate-90", tone)} aria-hidden>
        <circle cx="21" cy="21" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
        <circle
          cx="21"
          cy="21"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
        {confirmed && <Check size={16} weight="bold" className={cx("absolute inset-0 m-auto", tone)} aria-hidden />}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {passed ? "Deadline passed" : confirmed ? "You can still update for" : "Time left to confirm"}
        </div>
        <div className={cx("num text-[20px] font-semibold leading-tight", passed && !confirmed ? "text-bad" : "text-ink")}>
          {passed ? fmtTime(deadline) : clock}
        </div>
        <div className="text-[12px] text-ink-3">
          Last time: {sameDay ? "today" : fmtDate(deadline)} {fmtTime(deadline)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- The day form ---------------- */

function LocationDay({ data }: { data: DemandResponse }) {
  const { view, settings, now } = data;
  const rec = view.record;
  const toast = useToast();
  const [editing, setEditing] = useState(!rec.confirmed);
  const [expected, setExpected] = useState(rec.expectedCount);
  const [absences, setAbsences] = useState(rec.absenceCount);
  const [special, setSpecial] = useState<SpecialCounts>(rec.specialCounts);
  const [showSpecial, setShowSpecial] = useState(Object.values(rec.specialCounts).some((n) => n > 0));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);

  useEffect(() => setErr(null), [expected, absences, special, reason]);

  const diners = expected - absences;
  const prevDiners = rec.expectedCount - rec.absenceCount;
  const delta = diners - prevDiners;
  const needsReason = rec.confirmed && Math.abs(delta) > settings.materialChangeThreshold;
  const specialSum = SPECIAL_DIETS.reduce((s, k) => s + special[k], 0);
  const localErrors = {
    absences: absences > expected ? "Can't be more than the expected diners." : null,
    special: specialSum > Math.max(0, diners) ? "Special meals cannot exceed the number of diners." : null,
  };
  const dirty =
    expected !== rec.expectedCount || absences !== rec.absenceCount || SPECIAL_DIETS.some((k) => special[k] !== rec.specialCounts[k]);
  const isNext = data.date === data.serviceDate;

  const submit = async () => {
    if (localErrors.absences || localErrors.special) return;
    if (needsReason && !reason.trim()) {
      setErr({ msg: `Changes of more than ${settings.materialChangeThreshold} meals need a short reason for the kitchen.`, field: "reason" });
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/demand", {
        locationId: view.location.id,
        date: data.date,
        expectedCount: expected,
        absenceCount: absences,
        specialCounts: special,
        reason: reason || null,
        action: "confirm",
      });
      setJustConfirmed(true);
      toast({
        title: rec.confirmed ? "Update sent to the kitchen" : "Meal count confirmed",
        body: `${diners} diners for ${fmtDate(data.date)}`,
        tone: "ok",
      });
    } catch (e) {
      const ce = e as ClientApiError;
      setErr({ msg: ce.message, field: ce.field });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <section className="card rise overflow-hidden" style={{ "--i": 2 } as React.CSSProperties}>
        <header className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[26px]">{view.location.name}</h1>
              <StatusBadge status={view.status} size="sm" />
            </div>
            <p className="mt-1 text-[15px] text-ink-2">
              Lunch for <span className="font-medium text-ink">{fmtDate(data.date, true)}</span>
              {!isNext && <span className="text-ink-3"> · planning ahead</span>}
            </p>
            {data.meal && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-3">
                <ForkKnife size={15} aria-hidden /> {data.meal.mealName}
              </p>
            )}
          </div>
          <DeadlineTimer deadline={view.deadline} now={now} confirmed={rec.confirmed} real={settings.clockMode === "real"} />
        </header>

        {!editing ? (
          <ConfirmedSummary
            data={data}
            justConfirmed={justConfirmed}
            onEdit={() => {
              setEditing(true);
              setJustConfirmed(false);
            }}
          />
        ) : (
          <div className="flex flex-col">
            <div className="flex items-end justify-between gap-4 bg-canvas/60 px-5 py-6 sm:px-7">
              <div>
                <div className="text-sm font-medium text-ink-2">Pupils eating lunch</div>
                <div className="num mt-1 text-[56px] font-semibold leading-none tracking-[-0.04em] text-ink">{Math.max(0, diners)}</div>
              </div>
              <div className="pb-1 text-right text-[13px] leading-relaxed text-ink-3">
                <div>
                  <span className="num text-ink-2">{expected}</span> expected
                </div>
                <div>
                  − <span className="num text-ink-2">{absences}</span> on leave / absent
                </div>
                {rec.confirmed && delta !== 0 && (
                  <div className={cx("mt-1 font-medium", delta < 0 ? "text-info" : "text-warn")}>
                    {delta > 0 ? "+" : "−"}
                    {Math.abs(delta)} vs confirmed
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
              <Field
                label="On leave / absent"
                error={localErrors.absences}
                help="Pupils who won't eat lunch that day — sick, on leave or away on a trip."
              >
                <Stepper big label="pupils on leave or absent" value={absences} onChange={setAbsences} max={expected} invalid={!!localErrors.absences} />
              </Field>
              <Field
                label="Expected diners"
                help={
                  expected === view.location.normalCapacity
                    ? `Normal for this location: ${view.location.normalCapacity}`
                    : `Normal is ${view.location.normalCapacity} — change only for closures or visiting groups.`
                }
              >
                <Stepper label="expected diners" value={expected} onChange={setExpected} max={Math.round(view.location.normalCapacity * 1.5)} />
              </Field>
            </div>

            <div className="border-t border-line px-5 sm:px-7">
              <button
                onClick={() => setShowSpecial((s) => !s)}
                aria-expanded={showSpecial}
                className="flex w-full cursor-pointer items-center justify-between py-4 text-left"
              >
                <span>
                  <span className="text-sm font-medium text-ink">Special meals</span>
                  <span className="ml-2 text-[13px] text-ink-3">{specialSum > 0 ? `${specialSum} included in the count` : "Optional"}</span>
                </span>
                <CaretDown size={16} className={cx("text-ink-3 transition-transform duration-200 ease-out", showSpecial && "rotate-180")} />
              </button>
              {showSpecial && (
                <div className="fade-in grid grid-cols-1 gap-4 pb-5 sm:grid-cols-2">
                  {SPECIAL_DIETS.map((k) => (
                    <Field key={k} label={DIET_LABEL[k]}>
                      <Stepper
                        label={DIET_LABEL[k]}
                        value={special[k]}
                        onChange={(n) => setSpecial((s) => ({ ...s, [k]: n }))}
                        invalid={!!localErrors.special}
                      />
                    </Field>
                  ))}
                  {localErrors.special && <p className="text-[13px] font-medium text-bad sm:col-span-2">{localErrors.special}</p>}
                </div>
              )}
            </div>

            {needsReason && (
              <div className="fade-in border-t border-line px-5 py-5 sm:px-7">
                <Field
                  label="Reason for the change"
                  htmlFor="reason"
                  error={err?.field === "reason" ? err.msg : null}
                  help={`Required: the count moves by ${Math.abs(delta)} meals, more than the ${settings.materialChangeThreshold}-meal threshold.`}
                >
                  <input
                    id="reason"
                    className={inputCls}
                    value={reason}
                    maxLength={200}
                    aria-invalid={err?.field === "reason" || undefined}
                    placeholder="e.g. Grade 4 on a trip, flu cases this morning"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="min-h-5 text-[13px]">
                {err && err.field !== "reason" ? (
                  <span className="font-medium text-bad" role="alert">
                    {err.msg}
                  </span>
                ) : rec.confirmed ? (
                  <span className="text-ink-3">The kitchen sees this as an update, with the time and your reason.</span>
                ) : (
                  <span className="text-ink-3">Nothing reaches the kitchen until you confirm.</span>
                )}
              </div>
              <div className="flex gap-2">
                {rec.confirmed && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setExpected(rec.expectedCount);
                      setAbsences(rec.absenceCount);
                      setSpecial(rec.specialCounts);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="lg"
                  className="flex-1 sm:flex-none"
                  onClick={submit}
                  loading={busy}
                  disabled={!!localErrors.absences || !!localErrors.special || (rec.confirmed && !dirty)}
                >
                  <CheckCircle size={19} weight="bold" />
                  {rec.confirmed ? "Send update" : `Confirm ${Math.max(0, diners)} for ${fmtDate(data.date).slice(0, 3)}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-6">
        {data.plan && (
          <div className="rise flex gap-3 rounded-[14px] border border-info/20 bg-info-soft px-4 py-3.5 text-sm text-info" style={{ "--i": 3 } as React.CSSProperties}>
            <Info size={18} weight="bold" className="mt-0.5 shrink-0" />
            <p>
              The kitchen has planned this day ({fmtTime(data.plan.approvedAt)}). You can still update the count — they&apos;ll see it
              flagged as a change.
            </p>
          </div>
        )}

        <CountHistory rows={data.history} />

        {data.log.length > 0 && (
          <section className="card rise p-5" style={{ "--i": 5 } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-ink">Activity for this day</h2>
            <ol className="mt-3 flex flex-col gap-3">
              {data.log.map((c) => (
                <li key={c.id} className="flex gap-3 text-[13px]">
                  <span className="num w-11 shrink-0 pt-px text-ink-3">{fmtTime(c.timestamp)}</span>
                  <span className="text-ink-2">
                    {c.field === "confirm" ? (
                      <>
                        Confirmed <span className="num font-medium text-ink">{c.newValue.expected - c.newValue.absences}</span> diners
                        {c.afterDeadline && <span className="text-warn"> · after deadline</span>}
                      </>
                    ) : (
                      <>
                        Updated <span className="num">{c.previousValue ? c.previousValue.expected - c.previousValue.absences : "—"}</span> →{" "}
                        <span className="num font-medium text-ink">{c.newValue.expected - c.newValue.absences}</span>
                        {c.reason && <span className="block text-ink-3">“{c.reason}”</span>}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}

function ConfirmedSummary({ data, onEdit, justConfirmed }: { data: DemandResponse; onEdit: () => void; justConfirmed: boolean }) {
  const { view } = data;
  const rec = view.record;
  return (
    <div className={cx("flex flex-col gap-6 px-5 py-7 sm:px-7", justConfirmed && "pop-in")}>
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
          <CheckCircle size={24} weight="fill" />
        </span>
        <div>
          <div className="num text-[44px] font-semibold leading-none tracking-[-0.04em] text-ink">{view.netDiners}</div>
          <p className="mt-1.5 text-[15px] text-ink-2">
            pupils eating · <span className="num">{rec.expectedCount}</span> expected − <span className="num">{rec.absenceCount}</span> on
            leave / absent
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            Confirmed {fmtStamp(rec.confirmedAt)}
            {rec.changedAfterConfirm && <> · last update {fmtStamp(rec.updatedAt)}</>}
          </p>
        </div>
      </div>
      {view.specialTotal > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-canvas/70 p-4 text-sm sm:grid-cols-4">
          {SPECIAL_DIETS.map((k) => (
            <div key={k}>
              <dt className="text-[13px] text-ink-3">{DIET_LABEL[k]}</dt>
              <dd className="num font-medium text-ink">{rec.specialCounts[k]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onEdit}>
          <PencilSimpleLine size={17} /> Update the count
        </Button>
        <span className="text-[13px] text-ink-3">Someone fell ill or a trip was added? Update it — every meal you report saves one.</span>
      </div>
    </div>
  );
}

/* ---------------- Were your counts right? ---------------- */

/** "Spot on" tolerance: ±2 meals, or 1.5 % for bigger schools. */
const tolerance = (confirmed: number) => Math.max(2, Math.round(confirmed * 0.015));

function CountHistory({ rows }: { rows: HistoryRow[] }) {
  const recent = [...rows].reverse();
  const sent = rows.filter((r) => r.confirmed !== null);
  const spotOn = sent.filter((r) => Math.abs(r.ate - r.confirmed!) <= tolerance(r.confirmed!)).length;
  const fewer = sent.reduce((s, r) => s + Math.max(0, r.confirmed! - r.ate), 0);

  return (
    <section className="card rise overflow-hidden" style={{ "--i": 4 } as React.CSSProperties}>
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink">Were your counts right?</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
          The number you confirmed, compared with the pupils who actually ate lunch.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3">Results appear here after the kitchen records each lunch.</p>
      ) : (
        <>
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl bg-canvas/70 px-3.5 py-3">
            <div className="num text-[26px] font-semibold leading-none text-ink">
              {spotOn}
              <span className="text-[15px] font-medium text-ink-3">/{rows.length}</span>
            </div>
            <p className="text-[13px] leading-snug text-ink-2">
              days your count was spot on (within a couple of meals).
              {fewer > 0 && (
                <span className="text-ink-3"> {fewer} meals were cooked for pupils who didn&apos;t come.</span>
              )}
            </p>
          </div>

          <table className="mt-3 w-full border-t border-line text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
                <th className="py-2 pl-5 pr-2 font-medium">Day</th>
                <th className="px-2 py-2 text-right font-medium">You said</th>
                <th className="px-2 py-2 text-right font-medium">Ate</th>
                <th className="py-2 pl-2 pr-5 text-right font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {recent.map((r) => (
                <tr key={r.date}>
                  <td className="whitespace-nowrap py-2.5 pl-5 pr-2 text-ink-3">{fmtDate(r.date).slice(0, 6)}</td>
                  <td className="num px-2 py-2.5 text-right font-medium text-ink">{r.confirmed ?? "—"}</td>
                  <td className="num px-2 py-2.5 text-right text-ink-2">{r.ate}</td>
                  <td className="py-2.5 pl-2 pr-5 text-right">
                    <Verdict confirmed={r.confirmed} ate={r.ate} late={r.status === "late"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-5 py-3 text-[12px] leading-snug text-ink-3">
            “Fewer” usually means some absences weren&apos;t reported — those meals end up as leftovers.
          </p>
        </>
      )}
    </section>
  );
}

function Verdict({ confirmed, ate, late }: { confirmed: number | null; ate: number; late: boolean }) {
  const diff = confirmed === null ? null : ate - confirmed;
  if (diff === null)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-bad-soft px-2 py-0.5 text-[12px] font-medium text-bad">
        <WarningCircle size={12} weight="bold" /> Not sent
      </span>
    );
  if (Math.abs(diff) <= tolerance(confirmed!))
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">
        <Check size={12} weight="bold" /> Spot on{late && " · late"}
      </span>
    );
  if (diff < 0)
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-medium text-warn">
        <ArrowDown size={12} weight="bold" /> {-diff} fewer
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-info-soft px-2 py-0.5 text-[12px] font-medium text-info">
      <ArrowUp size={12} weight="bold" /> {diff} more
    </span>
  );
}
