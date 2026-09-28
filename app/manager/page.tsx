"use client";

import { DownloadSimple, Lightbulb, CaretRight, CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { DailyBars, ForecastServedChart, Legend, RankBars } from "@/components/charts";
import { useApi } from "@/components/providers";
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Segmented, Stat, cx, selectCls } from "@/components/ui";
import type { Analytics } from "@/lib/calculations";
import { fmtDate } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/labels";
import type { Location } from "@/lib/types";

type Resp = Analytics & { locations: Location[] };

const f1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const f0 = (n: number) => Math.round(n).toLocaleString("en-US");

function suggestion(l: Analytics["byLocation"][number]) {
  if (l.lateRate >= 25) return "Earlier reminder before the deadline; agree who confirms";
  if (l.topReason === "Unreported absences") return "Encourage same-morning absence notifications";
  if (l.topReason === "Menu acceptance") return "Review portioning on low-acceptance dishes";
  if (l.topReason === "Trip or event not reported") return "Share the trip calendar with the kitchen";
  if (l.surplusRate > 4) return "Review buffer for this location";
  return "On track";
}

export default function ManagerAnalytics() {
  const [days, setDays] = useState(30);
  const [loc, setLoc] = useState("");
  const { data, error, reload } = useApi<Resp>(`/api/analytics?days=${days}${loc ? `&locationId=${loc}` : ""}`);

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const k = data.kpis;
  const ins = data.insight;
  const attention = [...data.byLocation].sort((a, b) => b.lateRate + b.surplusRate * 6 - (a.lateRate + a.surplusRate * 6));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Manager · forecast accuracy and causes"
        title="Where surplus comes from"
        actions={
          <a
            href={`/api/export?days=${days}${loc ? `&locationId=${loc}` : ""}`}
            className="press inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:border-ink-3"
          >
            <DownloadSimple size={16} /> Export CSV
          </a>
        }
      >
        {data.period.from && (
          <>
            {fmtDate(data.period.from)} – {fmtDate(data.period.to!)} · {data.period.days} service days · synthetic data
          </>
        )}
      </PageHeader>

      {/* filters: one row, above everything they affect */}
      <div className="rise flex flex-wrap items-center gap-3" style={{ "--i": 1 } as React.CSSProperties}>
        <Segmented<number>
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: "7 days" },
            { value: 14, label: "14 days" },
            { value: 30, label: "30 days" },
          ]}
        />
        <div className="relative">
          <select aria-label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} className={cx(selectCls, "appearance-none")}>
            <option value="">All locations</option>
            {data.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <CaretDown size={14} className="pointer-events-none absolute right-3 top-3 text-ink-3" />
        </div>
      </div>

      {data.daily.length === 0 && data.byLocation.every((l) => l.days === 0) ? (
        <EmptyState title="No results recorded in this period">Record post-service results to build the analysis.</EmptyState>
      ) : (
        <>
          <section
            aria-label="Key figures"
            className="card rise grid grid-cols-2 divide-line md:grid-cols-5 md:divide-x max-md:[&>*:nth-child(n+3)]:border-t"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <Stat label="Forecast accuracy" value={`${f1(k.accuracy)} %`} sub="1 − |forecast − served| / served" />
            <Stat label="Avg. variance" value={f0(k.avgAbsVariancePerDay)} sub={`meals/day · bias ${k.bias >= 0 ? "+" : "−"}${f1(Math.abs(k.bias))} per site`} />
            <Stat label="Avg. surplus" value={f0(k.avgSurplusPerDay)} sub={`meals/day · ${f1(k.surplusRate)} % of produced`} />
            <Stat label="Avg. food waste" value={`${f1(k.avgWastePerDay)}`} sub="kg per day" />
            <Stat label="Late or missing" value={`${f0(k.lateRate)} %`} sub="of confirmations" tone={k.lateRate > 15 ? "warn" : undefined} />
          </section>

          {ins.lateShareOfRows > 0 && ins.ratio > 1.2 && (
            <section
              className="rise flex gap-3 rounded-[16px] border border-accent/15 bg-accent-soft px-5 py-4"
              style={{ "--i": 3 } as React.CSSProperties}
            >
              <Lightbulb size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
              <div className="text-[15px] leading-relaxed text-accent-ink">
                <p className="font-semibold">
                  Late or missing confirmations are {f0(ins.lateShareOfRows)} % of location-days but {f0(ins.lateShareOfSurplus)} % of
                  surplus.
                </p>
                <p className="mt-0.5 text-sm text-accent-ink/85">
                  When a count arrives late the kitchen plans on an estimate: surplus averages{" "}
                  <span className="num font-medium">{f1(ins.lateSurplus)}</span> meals per location-day, against{" "}
                  <span className="num font-medium">{f1(ins.onTimeSurplus)}</span> when the count is confirmed on time (
                  {f1(ins.ratio)}×). Improving information timing looks like a larger lever than trimming buffers.
                </p>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section className="card rise min-w-0 p-5" style={{ "--i": 4 } as React.CSSProperties}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-ink">Forecast vs served, by day</h2>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    Diner forecast used at approval, against meals actually served
                    {(data.period.partialDays?.length ?? 0) > 0 && (
                      <> · {data.period.partialDays.map((d) => fmtDate(d)).join(", ")} partly recorded, not shown</>
                    )}
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
                <ForecastServedChart data={data.daily} />
              </div>
            </section>

            <section className="card rise min-w-0 p-5" style={{ "--i": 5 } as React.CSSProperties}>
              <h2 className="font-semibold text-ink">Variance reasons</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Recorded when served differed materially from the forecast</p>
              <div className="mt-5">
                {data.reasons.length ? (
                  <RankBars rows={data.reasons.map((r) => ({ label: r.reason, value: r.count }))} format={(n) => `${n}×`} tone="forecast" />
                ) : (
                  <p className="text-sm text-ink-3">No material variances in this period.</p>
                )}
              </div>
            </section>

            <section className="card rise min-w-0 p-5" style={{ "--i": 6 } as React.CSSProperties}>
              <h2 className="font-semibold text-ink">Surplus meals per day</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Solid bars: days with at least one late or missing confirmation</p>
              <div className="mt-4">
                <DailyBars data={data.daily} dataKey="surplus" name="Surplus" highlightKey="lateCount" height={300} />
              </div>
            </section>

            <section className="card rise min-w-0 p-5" style={{ "--i": 7 } as React.CSSProperties}>
              <h2 className="font-semibold text-ink">Surplus rate by location</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Share of produced meals left over · late/missing rate alongside</p>
              <div className="mt-5">
                <RankBars
                  rows={[...data.byLocation]
                    .sort((a, b) => b.surplusRate - a.surplusRate)
                    .map((l) => ({ label: l.name, value: l.surplusRate, sub: `${f0(l.lateRate)} % late` }))}
                  format={(n) => `${f1(n)} %`}
                />
              </div>
            </section>
          </div>

          <section className="card rise min-w-0 overflow-hidden" style={{ "--i": 8 } as React.CSSProperties}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Locations requiring attention</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Ranked by late-confirmation rate and surplus rate. Suggestions are prompts for a conversation, not conclusions.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                    <th className="px-5 py-2.5 font-medium">Location</th>
                    <th className="px-3 py-2.5 text-right font-medium">Accuracy</th>
                    <th className="px-3 py-2.5 text-right font-medium">Avg. |variance|</th>
                    <th className="px-3 py-2.5 text-right font-medium">Surplus rate</th>
                    <th className="px-3 py-2.5 text-right font-medium">Late / missing</th>
                    <th className="px-3 py-2.5 text-right font-medium">Waste kg</th>
                    <th className="px-3 py-2.5 font-medium">Top reason</th>
                    <th className="px-5 py-2.5 font-medium">Suggested focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attention.map((l) => (
                    <tr key={l.id} className="group hover:bg-canvas/60">
                      <td className="px-5 py-3">
                        <Link href={`/kitchen/locations/${l.id}`} className="flex items-center gap-1 font-medium text-ink hover:underline">
                          {l.name}
                          <CaretRight size={13} className="text-ink-3" />
                        </Link>
                        <div className="text-xs text-ink-3">{TYPE_LABEL[l.type]}</div>
                      </td>
                      <td className="num px-3 py-3 text-right text-ink-2">{f1(l.accuracy)} %</td>
                      <td className="num px-3 py-3 text-right text-ink-2">{f1(l.avgAbsVariance)}</td>
                      <td className={cx("num px-3 py-3 text-right", l.surplusRate > 4 ? "font-medium text-warn" : "text-ink-2")}>
                        {f1(l.surplusRate)} %
                      </td>
                      <td className={cx("num px-3 py-3 text-right", l.lateRate >= 25 ? "font-medium text-bad" : "text-ink-2")}>
                        {f0(l.lateRate)} %
                      </td>
                      <td className="num px-3 py-3 text-right text-ink-2">{f1(l.wasteKg)}</td>
                      <td className="px-3 py-3 text-[13px] text-ink-2">{l.topReason ?? "—"}</td>
                      <td className="px-5 py-3 text-[13px] text-ink">{suggestion(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
