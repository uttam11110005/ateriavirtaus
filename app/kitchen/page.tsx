"use client";

import { ArrowRight, CaretRight, MagnifyingGlass, Phone, WarningCircle, Info, ForkKnife } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApi } from "@/components/providers";
import { RecommendationCard, type RecommendationData } from "@/components/recommendation";
import {
  ErrorState,
  EmptyState,
  inputCls,
  LinkButton,
  PageHeader,
  PageSkeleton,
  Segmented,
  Stat,
  StatusBadge,
  cx,
} from "@/components/ui";
import { fmtDate, fmtDuration, fmtStamp, fmtTime } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/labels";
import type { DemandStatus, LocationDemandView } from "@/lib/types";

type Filter = "all" | "attention" | DemandStatus;

export default function KitchenOverview() {
  const { data, error, reload } = useApi<RecommendationData>("/api/production/recommendation", { poll: 5000 });
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (q && !r.location.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "attention") return r.status === "missing" || r.status === "late" || r.status === "changed" || r.status === "draft";
      return r.status === filter;
    });
  }, [data, filter, q]);

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const c = data.counts;
  const missing = data.rows.filter((r) => r.status === "missing");
  const dueSoon = data.rows.filter((r) => r.status === "draft");
  const reported = c.confirmed + c.changed + c.late;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent text-accent" aria-hidden /> Kitchen overview · updates live
          </span>
        }
        title={`Demand for ${fmtDate(data.serviceDate, true)}`}
        actions={
          <>
            <LinkButton href="/kitchen/production">Full calculation</LinkButton>
            <LinkButton href="/kitchen/actuals">Post-service entry</LinkButton>
          </>
        }
      >
        {data.meal && (
          <span className="flex items-center gap-1.5">
            <ForkKnife size={16} className="text-ink-3" aria-hidden /> {data.meal.mealName}
          </span>
        )}
      </PageHeader>

      {/* ---------- alerts ---------- */}
      {(missing.length > 0 || dueSoon.length > 0) && (
        <div className="rise flex flex-col gap-2" style={{ "--i": 1 } as React.CSSProperties}>
          {missing.map((r) => (
            <div key={r.location.id} className="flex flex-col gap-2 rounded-[14px] border border-bad/20 bg-bad-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2.5 text-bad">
                <WarningCircle size={19} weight="bold" className="mt-px shrink-0" />
                <p>
                  <span className="font-semibold">{r.location.name}</span> has not confirmed — deadline {fmtTime(r.deadline)} passed{" "}
                  {fmtDuration(r.minutesToDeadline)} ago. Planning uses an estimate of{" "}
                  <span className="num font-semibold">{r.netDiners}</span>.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 pl-7 text-[13px] text-bad sm:pl-0">
                <Phone size={15} aria-hidden /> Contact {r.location.contact}
              </span>
            </div>
          ))}
          {dueSoon.length > 0 && (
            <div className="flex gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-ink-2">
              <Info size={19} weight="bold" className="mt-px shrink-0 text-ink-3" />
              <p>
                Waiting for {dueSoon.map((r) => r.location.name).join(", ")} — due{" "}
                {fmtTime(dueSoon[0].deadline)} ({fmtDuration(dueSoon[0].minutesToDeadline)} left). Estimates are used until they confirm.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------- KPIs ---------- */}
      <section
        aria-label="Key figures"
        className="card rise grid grid-cols-2 divide-line max-md:[&>*:nth-child(n+3)]:border-t md:grid-cols-5 md:divide-x"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <Stat label="Total expected diners" value={data.totals.netDiners} sub={`of ${data.totals.expectedPopulation} registered`} />
        <Stat label="Confirmed" value={`${reported}/${data.rows.length}`} sub={`${data.totals.confirmedDiners} diners known`} tone="ok" />
        <Stat
          label="Missing"
          value={c.missing}
          sub={c.missing ? `${data.rows.filter((r) => r.status === "missing").reduce((s, r) => s + r.netDiners, 0)} diners estimated` : "none"}
          tone={c.missing ? "bad" : undefined}
        />
        <Stat label="Changed" value={c.changed} sub="corrected after confirming" tone={c.changed ? "info" : undefined} />
        <Stat label="Late" value={c.late} sub="confirmed after deadline" tone={c.late ? "warn" : undefined} />
      </section>

      {/* ---------- table + recommendation ---------- */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <section className="card rise min-w-0 overflow-hidden" style={{ "--i": 3 } as React.CSSProperties} aria-label="Locations">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Segmented<Filter>
                label="Filter by status"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `All ${data.rows.length}` },
                  { value: "attention", label: `Needs attention ${c.missing + c.late + c.changed + c.draft}` },
                  { value: "confirmed", label: "Confirmed" },
                  { value: "missing", label: "Missing" },
                ]}
              />
            </div>
            <div className="relative lg:w-56">
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-3 text-ink-3" />
              <input
                aria-label="Search locations"
                placeholder="Search location"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cx(inputCls, "h-10 pl-9 text-sm")}
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No locations match">Try another status or clear the search.</EmptyState>
            </div>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                    <th className="px-4 py-2.5 font-medium">Location</th>
                    <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                    <th className="px-3 py-2.5 text-right font-medium">Absences</th>
                    <th className="px-3 py-2.5 text-right font-medium">Final count</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Last update</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <Row key={r.location.id} r={r} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong bg-canvas/60 text-sm">
                    <td className="px-4 py-3 font-medium text-ink">Total ({rows.length})</td>
                    <td className="num px-3 py-3 text-right text-ink-2">{rows.reduce((s, r) => s + r.record.expectedCount, 0)}</td>
                    <td className="num px-3 py-3 text-right text-ink-2">
                      {rows.reduce((s, r) => s + r.record.expectedCount - r.netDiners, 0)}
                    </td>
                    <td className="num px-3 py-3 text-right font-semibold text-ink">{rows.reduce((s, r) => s + r.netDiners, 0)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {rows.map((r) => (
                  <li key={r.location.id}>
                    <Link href={`/kitchen/locations/${r.location.id}`} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{r.location.name}</div>
                        <div className="mt-1">
                          <StatusBadge status={r.status} size="sm" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cx("num text-lg font-semibold", r.isEstimate ? "text-ink-3" : "text-ink")}>
                          {r.isEstimate && "≈"}
                          {r.netDiners}
                        </div>
                        <div className="text-xs text-ink-3">{r.isEstimate ? "estimate" : `${r.record.absenceCount} absent`}</div>
                      </div>
                      <CaretRight size={16} className="text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
            <span className="text-ink-2">≈</span> marks an estimate (registered minus typical absences) used until the location confirms.
          </p>
        </section>

        <aside className="rise xl:sticky xl:top-24" style={{ "--i": 4 } as React.CSSProperties}>
          <RecommendationCard snap={data} />
          <Link
            href="/kitchen/production"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            See the calculation per location <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ r }: { r: LocationDemandView }) {
  return (
    <tr className="group relative transition-colors duration-150 hover:bg-canvas/70">
      <td className="px-4 py-3">
        <Link href={`/kitchen/locations/${r.location.id}`} className="font-medium text-ink after:absolute after:inset-0">
          {r.location.name}
        </Link>
        <div className="text-xs text-ink-3">
          {TYPE_LABEL[r.location.type]} · due {fmtTime(r.deadline)}
        </div>
      </td>
      <td className="num px-3 py-3 text-right text-ink-2">{r.record.expectedCount}</td>
      <td className="num px-3 py-3 text-right text-ink-2">
        {r.isEstimate ? <span className="text-ink-3">≈{r.record.expectedCount - r.netDiners}</span> : r.record.absenceCount}
      </td>
      <td className="num px-3 py-3 text-right">
        <span className={cx("text-[15px] font-semibold", r.isEstimate ? "text-ink-3" : "text-ink")}>
          {r.isEstimate && "≈"}
          {r.netDiners}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={r.status} size="sm" />
      </td>
      <td className="px-3 py-3 text-[13px] text-ink-2">
        {r.record.updatedAt ? (
          <>
            <span className="num">{fmtStamp(r.record.updatedAt).slice(-5)}</span>
            {r.lastChange?.reason && (
              <span className="block max-w-[180px] truncate text-xs text-ink-3" title={r.lastChange.reason}>
                {r.lastChange.reason}
              </span>
            )}
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </td>
      <td className="pr-3 text-ink-3">
        <CaretRight size={15} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </td>
    </tr>
  );
}
