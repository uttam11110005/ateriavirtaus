"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useApi } from "@/components/providers";
import { ApprovalPanel, Rationale, SpecialBreakdown, type RecommendationData } from "@/components/recommendation";
import { ConfidenceBadge, ErrorState, PageHeader, PageSkeleton, StatusBadge, cx } from "@/components/ui";
import { fmtDate } from "@/lib/dates";

export default function ProductionDecision() {
  const { data, error, reload } = useApi<RecommendationData>("/api/production/recommendation", { poll: 8000 });
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const s = data.settings;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Production decision" title={`How the ${data.totals.recommended}-meal recommendation is built`}>
        Service day {fmtDate(data.serviceDate, true)}. Every number below is visible and editable by a person — the system
        recommends, the kitchen decides.
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
          <section className="card rise flex flex-col gap-5 p-5" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-2">Recommendation</span>
              <ConfidenceBadge level={data.confidence} />
            </div>
            <div className="num -mt-2 text-[52px] font-semibold leading-none tracking-[-0.045em] text-ink">{data.totals.recommended}</div>
            <Rationale snap={data} />
            <ApprovalPanel snap={data} compact />
          </section>
          <section className="rise flex flex-col gap-3" style={{ "--i": 2 } as React.CSSProperties}>
            <SpecialBreakdown snap={data} />
            <div className="flex gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-[13px] leading-relaxed text-ink-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" weight="duotone" />
              <p>
                <span className="font-medium text-ink">Confidence</span> reflects data completeness, not statistical
                probability: high when every count is confirmed on time, medium when some are late or still open, low when a
                significant share is missing.
              </p>
            </div>
          </section>
        </aside>

        <section className="card rise min-w-0 overflow-hidden" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold text-ink">Per-location calculation</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Forecast = diners after absences + historical adjustment. Buffer = {s.bufferPercent} % of forecast. Adjustment uses up
              to 20 recent confirmed days and is capped at 5 %{s.useHistoricalAdjustment ? "" : " (currently switched off)"}.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                  <th className="px-5 py-2.5 font-medium">Location</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                  <th className="px-3 py-2.5 text-right font-medium">Absences</th>
                  <th className="px-3 py-2.5 text-right font-medium">Adj.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Forecast</th>
                  <th className="px-3 py-2.5 text-right font-medium">Buffer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Recommended</th>
                  <th className="px-5 py-2.5 font-medium">Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.location.id} className="align-top">
                    <td className="px-5 py-3">
                      <Link href={`/kitchen/locations/${r.location.id}`} className="font-medium text-ink hover:underline">
                        {r.location.name}
                      </Link>
                      <div className="mt-1">
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                    </td>
                    <td className="num px-3 py-3 text-right text-ink-2">{r.record.expectedCount}</td>
                    <td className={cx("num px-3 py-3 text-right", r.isEstimate ? "text-ink-3" : "text-ink-2")}>
                      {r.isEstimate ? "≈" : "−"}
                      {r.record.expectedCount - r.netDiners}
                    </td>
                    <td className="num px-3 py-3 text-right text-ink-2" title={`${r.historyObservations} observations`}>
                      {r.historicalAdjustment === 0 ? "0" : `${r.historicalAdjustment > 0 ? "+" : "−"}${Math.abs(r.historicalAdjustment)}`}
                    </td>
                    <td className="num px-3 py-3 text-right text-ink">{r.forecast}</td>
                    <td className="num px-3 py-3 text-right text-ink-2">+{r.buffer}</td>
                    <td className="num px-3 py-3 text-right text-[15px] font-semibold text-ink">{r.recommended}</td>
                    <td className="px-5 py-3 text-[13px] leading-snug text-ink-3">
                      {r.isEstimate ? (
                        <span className="text-warn">Estimate: {r.estimateBasis}</span>
                      ) : (
                        <>Confirmed count{r.historyObservations ? ` · adj. from ${r.historyObservations} days` : ""}</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong bg-canvas/60">
                  <td className="px-5 py-3 font-medium text-ink">Total</td>
                  <td className="num px-3 py-3 text-right text-ink-2">{data.totals.expectedPopulation}</td>
                  <td className="num px-3 py-3 text-right text-ink-2">−{data.totals.absences}</td>
                  <td className="num px-3 py-3 text-right text-ink-2">
                    {data.totals.adjustment < 0 ? "−" : "+"}
                    {Math.abs(data.totals.adjustment)}
                  </td>
                  <td className="num px-3 py-3 text-right text-ink">{data.totals.netDiners + data.totals.adjustment}</td>
                  <td className="num px-3 py-3 text-right text-ink-2">+{data.totals.buffer}</td>
                  <td className="num px-3 py-3 text-right text-base font-semibold text-ink">{data.totals.recommended}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3.5 text-[13px] leading-relaxed text-ink-2">{data.explanation}</p>
        </section>
      </div>
    </div>
  );
}
