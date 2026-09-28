"use client";

import { ArrowLeft, Phone, Timer } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ForecastServedChart, Legend } from "@/components/charts";
import { useApi } from "@/components/providers";
import { ErrorState, PageSkeleton, Stat, StatusBadge, cx, ConfidenceBadge } from "@/components/ui";
import type { AnalyticsRow } from "@/lib/calculations";
import { fmtDate, fmtDuration, fmtStamp, fmtTime } from "@/lib/dates";
import { DIET_LABEL, TYPE_LABEL } from "@/lib/labels";
import type { ChangeLog, LocationDemandView, Settings } from "@/lib/types";
import { SPECIAL_DIETS } from "@/lib/types";

interface DetailResponse {
  now: string;
  serviceDate: string;
  view: LocationDemandView;
  explanation: string;
  history: AnalyticsRow[];
  log: ChangeLog[];
  settings: Settings;
}

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<DetailResponse>(`/api/locations/${id}`, { poll: 10000 });
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const { view: v, history } = data;
  const late = history.filter((h) => h.status === "late" || h.status === "missing").length;
  const surplus = history.reduce((s, h) => s + h.surplus, 0);
  const served = history.reduce((s, h) => s + h.served, 0);
  const absErr = history.reduce((s, h) => s + Math.abs(h.forecast - h.served), 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/kitchen" className="rise inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Kitchen overview
      </Link>

      <div className="rise flex flex-col gap-3 md:flex-row md:items-end md:justify-between" style={{ "--i": 1 } as React.CSSProperties}>
        <div>
          <div className="text-[13px] font-medium text-ink-3">
            {TYPE_LABEL[v.location.type]} · normal capacity {v.location.normalCapacity}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.025em] text-ink">{v.location.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="flex items-center gap-1.5">
              <Phone size={15} className="text-ink-3" /> {v.location.contact}
            </span>
            <span className="flex items-center gap-1.5">
              <Timer size={15} className="text-ink-3" /> Deadline {fmtTime(v.deadline)} the previous working day
            </span>
          </p>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="card rise overflow-hidden" style={{ "--i": 2 } as React.CSSProperties}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-semibold text-ink">{fmtDate(data.serviceDate, true)}</h2>
              <ConfidenceBadge level={v.confidence} />
            </div>
            <div className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x max-md:[&>*:nth-child(n+3)]:border-t">
              <Stat label="Expected" value={v.record.expectedCount} />
              <Stat label={v.isEstimate ? "Absences (est.)" : "Absences"} value={v.record.expectedCount - v.netDiners} />
              <Stat label="Final count" value={`${v.isEstimate ? "≈" : ""}${v.netDiners}`} tone={v.isEstimate ? "warn" : undefined} />
              <Stat label="Recommended" value={v.recommended} sub={`adj. ${v.historicalAdjustment} · buffer ${v.buffer}`} />
            </div>
            <p className="border-t border-line px-5 py-3.5 text-[13px] leading-relaxed text-ink-2">
              {data.explanation}
              {v.isEstimate && <span className="block text-warn">Not confirmed yet — {v.estimateBasis}.</span>}
              {v.minutesToDeadline > 0 && !v.record.confirmed && (
                <span className="block text-ink-3">{fmtDuration(v.minutesToDeadline)} until the deadline.</span>
              )}
            </p>
            {v.specialTotal > 0 && (
              <dl className="grid grid-cols-2 gap-3 border-t border-line px-5 py-3.5 text-[13px] sm:grid-cols-4">
                {SPECIAL_DIETS.map((k) => (
                  <div key={k}>
                    <dt className="text-ink-3">{DIET_LABEL[k]}</dt>
                    <dd className="num font-medium text-ink">{v.record.specialCounts[k]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="card rise p-5" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink">Forecast vs served — last {history.length} days</h2>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  Accuracy {served ? (100 * (1 - absErr / served)).toFixed(1) : "—"} % · surplus {surplus} meals · late or missing on {late} of{" "}
                  {history.length} days
                </p>
              </div>
              <Legend
                items={[
                  { label: "Forecast", color: "var(--color-series-forecast)", dashed: true },
                  { label: "Served", color: "var(--color-series-served)" },
                ]}
              />
            </div>
            <div className="mt-4">
              {history.length ? (
                <ForecastServedChart data={history} height={230} />
              ) : (
                <p className="py-10 text-center text-sm text-ink-3">No history yet.</p>
              )}
            </div>
          </section>
        </div>

        <section className="card rise p-5" style={{ "--i": 4 } as React.CSSProperties}>
          <h2 className="font-semibold text-ink">Change log</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Every confirmation and correction, with old and new values.</p>
          {data.log.length === 0 ? (
            <p className="mt-6 text-sm text-ink-3">No changes recorded.</p>
          ) : (
            <ol className="mt-4 flex flex-col">
              {data.log.map((c) => {
                const prev = c.previousValue ? c.previousValue.expected - c.previousValue.absences : null;
                const next = c.newValue.expected - c.newValue.absences;
                return (
                  <li key={c.id} className="relative border-l border-line pb-4 pl-4 last:pb-0">
                    <span
                      className={cx(
                        "absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full",
                        c.afterDeadline ? "bg-warn" : c.field === "count" ? "bg-info" : "bg-ok",
                      )}
                      aria-hidden
                    />
                    <div className="text-xs text-ink-3">
                      For {fmtDate(c.date)} · {fmtStamp(c.timestamp)}
                      {c.afterDeadline && <span className="text-warn"> · after deadline</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-ink">
                      {c.field === "confirm" ? (
                        <>
                          Confirmed <span className="num font-medium">{next}</span>
                        </>
                      ) : (
                        <>
                          Changed <span className="num">{prev}</span> → <span className="num font-medium">{next}</span>
                        </>
                      )}
                    </div>
                    {c.reason && <div className="text-[13px] text-ink-2">“{c.reason}”</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
