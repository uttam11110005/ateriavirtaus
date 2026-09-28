"use client";

import { CheckCircle, FloppyDisk, ArrowRight } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { apiPost, ClientApiError, useApi, useSession, useToast } from "@/components/providers";
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageSkeleton,
  StatusBadge,
  cx,
  selectCls,
} from "@/components/ui";
import { varianceNeedsReason } from "@/lib/calculations";
import { fmtDate } from "@/lib/dates";
import type { DemandStatus, Location, MealPlan, ProductionPlan, ServiceActual } from "@/lib/types";
import { VARIANCE_REASONS } from "@/lib/types";

interface ActualsResponse {
  now: string;
  date: string | null;
  plan: ProductionPlan | null;
  pendingDates: string[];
  recentDates: string[];
  meal: MealPlan | null;
  varianceThreshold: number;
  rows: { location: Location; planned: number; forecast: number; status: DemandStatus | null; actual: ServiceActual | null }[];
}

interface RowState {
  produced: string;
  served: string;
  surplus: string;
  surplusTouched: boolean;
  wasteKg: string;
  reason: string;
}

export default function PostService() {
  const [date, setDate] = useState<string | null>(null);
  const { data, error, reload } = useApi<ActualsResponse>(`/api/actuals${date ? `?date=${date}` : ""}`);

  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const options = [...new Set([...data.pendingDates, ...data.recentDates])].sort().reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Post-service entry"
        title={data.date ? `Results for ${fmtDate(data.date, true)}` : "Results"}
        actions={
          options.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Service day
              <select className={selectCls} value={data.date ?? ""} onChange={(e) => setDate(e.target.value)}>
                {options.map((d) => (
                  <option key={d} value={d}>
                    {fmtDate(d)}
                    {data.pendingDates.includes(d) ? " — to record" : ""}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      >
        Record what was produced, served and left over. Surplus is calculated from produced − served; change it if part of the
        difference was reused safely. Large gaps between forecast and served need a reason — that is what the manager learns from.
      </PageHeader>

      {!data.plan || !data.date ? (
        <EmptyState title="No approved production yet" action={<LinkButton href="/kitchen">Go to overview</LinkButton>}>
          Approve a production quantity first; results are recorded against the approved plan.
        </EmptyState>
      ) : (
        <ActualsForm key={data.date} data={data} />
      )}
    </div>
  );
}

function ActualsForm({ data }: { data: ActualsResponse }) {
  const { role } = useSession();
  const toast = useToast();
  const canEdit = role === "kitchen" || role === "admin";
  const init = () =>
    Object.fromEntries(
      data.rows.map((r) => [
        r.location.id,
        {
          produced: String(r.actual?.produced ?? r.planned),
          served: r.actual ? String(r.actual.served) : "",
          surplus: r.actual ? String(r.actual.surplus) : "",
          surplusTouched: !!r.actual && r.actual.surplus !== r.actual.produced - r.actual.served,
          wasteKg: r.actual ? String(r.actual.wasteKg) : "",
          reason: r.actual?.reason ?? "",
        } satisfies RowState,
      ]),
    ) as Record<string, RowState>;
  const [rows, setRows] = useState<Record<string, RowState>>(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(false), [rows]);

  const upd = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => {
      const next = { ...prev[id], ...patch };
      if (!next.surplusTouched && (patch.produced !== undefined || patch.served !== undefined)) {
        const p = parseInt(next.produced, 10);
        const s = parseInt(next.served, 10);
        next.surplus = Number.isFinite(p) && Number.isFinite(s) ? String(Math.max(0, p - s)) : "";
      }
      return { ...prev, [id]: next };
    });

  const computed = useMemo(
    () =>
      data.rows.map((r) => {
        const st = rows[r.location.id];
        const produced = parseInt(st.produced, 10);
        const served = parseInt(st.served, 10);
        const filled = st.served.trim() !== "" && Number.isFinite(served);
        const needsReason = filled && varianceNeedsReason(r.forecast, served, data.varianceThreshold);
        return { r, st, produced, served, filled, needsReason, variance: filled ? r.forecast - served : null };
      }),
    [data, rows],
  );

  const filled = computed.filter((c) => c.filled);
  const totals = {
    forecastAll: data.rows.reduce((s, r) => s + r.forecast, 0),
    forecast: filled.reduce((s, c) => s + c.r.forecast, 0),
    produced: filled.reduce((s, c) => s + (c.produced || 0), 0),
    served: filled.reduce((s, c) => s + (c.served || 0), 0),
    surplus: filled.reduce((s, c) => s + (parseInt(c.st.surplus, 10) || 0), 0),
    waste: filled.reduce((s, c) => s + (parseFloat(c.st.wasteKg) || 0), 0),
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    for (const c of filled) {
      const id = c.r.location.id;
      if (!Number.isFinite(c.produced) || c.produced < 0) errs[`${id}.produced`] = "Enter produced";
      else if (c.served > c.produced) errs[`${id}.served`] = "More than produced";
      if (c.st.wasteKg.trim() === "" || !(parseFloat(c.st.wasteKg) >= 0)) errs[`${id}.wasteKg`] = "Enter kg";
      if (c.needsReason && !c.st.reason) errs[`${id}.reason`] = "Pick a reason";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!filled.length) {
      setErrors({ form: "Enter served meals for at least one location." });
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/actuals", {
        date: data.date,
        rows: filled.map((c) => ({
          locationId: c.r.location.id,
          produced: c.produced,
          served: c.served,
          surplus: parseInt(c.st.surplus, 10) || 0,
          wasteKg: parseFloat(c.st.wasteKg),
          reason: c.st.reason || null,
        })),
      });
      setSaved(true);
      toast({ title: "Results saved", body: `${filled.length} locations · surplus ${totals.surplus} meals`, tone: "ok" });
    } catch (e) {
      const ce = e as ClientApiError;
      setErrors(ce.field ? { [ce.field]: ce.message } : { form: ce.message });
    } finally {
      setBusy(false);
    }
  };

  const numCls = (err?: string) =>
    cx(
      "num h-10 w-full min-w-0 rounded-[9px] border bg-surface px-2.5 text-right text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_rgba(29,92,71,0.15)] disabled:bg-sunken",
      err ? "border-bad" : "border-line-strong",
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="card rise overflow-hidden" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5 text-[13px] text-ink-3">
          <span>
            Approved <span className="num font-medium text-ink">{data.plan!.totalApproved}</span> meals
            {data.meal && <> · {data.meal.mealName}</>}
          </span>
          <span>Variance needing a reason: more than {data.varianceThreshold} % of forecast (min. 3 meals)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                <th className="px-5 py-2.5 font-medium">Location</th>
                <th className="px-2 py-2.5 text-right font-medium">Forecast</th>
                <th className="w-[104px] px-2 py-2.5 text-right font-medium">Produced</th>
                <th className="w-[104px] px-2 py-2.5 text-right font-medium">Served</th>
                <th className="w-[96px] px-2 py-2.5 text-right font-medium">Surplus</th>
                <th className="w-[96px] px-2 py-2.5 text-right font-medium">Waste kg</th>
                <th className="px-2 py-2.5 text-right font-medium">Variance</th>
                <th className="w-[230px] px-5 py-2.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {computed.map(({ r, st, needsReason, variance }) => {
                const id = r.location.id;
                return (
                  <tr key={id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{r.location.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {r.status && <StatusBadge status={r.status} size="sm" />}
                        {r.actual && <span className="text-xs text-ok">Recorded</span>}
                      </div>
                    </td>
                    <td className="num px-2 py-3 pt-5 text-right text-ink-2">{r.forecast}</td>
                    <td className="px-2 py-3">
                      <input
                        aria-label={`Produced at ${r.location.name}`}
                        inputMode="numeric"
                        disabled={!canEdit}
                        className={numCls(errors[`${id}.produced`])}
                        value={st.produced}
                        onChange={(e) => upd(id, { produced: e.target.value.replace(/\D/g, "") })}
                      />
                      <div className="mt-1 text-right text-[11px] text-ink-3">plan {r.planned}</div>
                    </td>
                    <td className="px-2 py-3">
                      <input
                        aria-label={`Served at ${r.location.name}`}
                        inputMode="numeric"
                        disabled={!canEdit}
                        placeholder="—"
                        className={numCls(errors[`${id}.served`])}
                        value={st.served}
                        onChange={(e) => upd(id, { served: e.target.value.replace(/\D/g, "") })}
                      />
                      {errors[`${id}.served`] && <div className="mt-1 text-right text-[11px] font-medium text-bad">{errors[`${id}.served`]}</div>}
                    </td>
                    <td className="px-2 py-3">
                      <input
                        aria-label={`Surplus at ${r.location.name}`}
                        inputMode="numeric"
                        disabled={!canEdit}
                        className={numCls(errors[`${id}.surplus`])}
                        value={st.surplus}
                        onChange={(e) => upd(id, { surplus: e.target.value.replace(/\D/g, ""), surplusTouched: true })}
                      />
                      <div className="mt-1 text-right text-[11px] text-ink-3">{st.surplusTouched ? "edited" : "auto"}</div>
                    </td>
                    <td className="px-2 py-3">
                      <input
                        aria-label={`Food waste kg at ${r.location.name}`}
                        inputMode="decimal"
                        disabled={!canEdit}
                        placeholder="0.0"
                        className={numCls(errors[`${id}.wasteKg`])}
                        value={st.wasteKg}
                        onChange={(e) => upd(id, { wasteKg: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })}
                      />
                      {errors[`${id}.wasteKg`] && <div className="mt-1 text-right text-[11px] font-medium text-bad">{errors[`${id}.wasteKg`]}</div>}
                    </td>
                    <td className="num px-2 py-3 pt-5 text-right">
                      {variance === null ? (
                        <span className="text-ink-3">—</span>
                      ) : (
                        <span className={cx("font-medium", needsReason ? "text-warn" : "text-ink-2")}>
                          {variance === 0 ? "0" : `${variance > 0 ? "+" : "−"}${Math.abs(variance)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {needsReason || st.reason ? (
                        <>
                          <select
                            aria-label={`Variance reason at ${r.location.name}`}
                            disabled={!canEdit}
                            value={st.reason}
                            onChange={(e) => upd(id, { reason: e.target.value })}
                            className={cx(selectCls, "w-full", errors[`${id}.reason`] && "border-bad")}
                          >
                            <option value="">Select reason…</option>
                            {VARIANCE_REASONS.map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          {errors[`${id}.reason`] && <div className="mt-1 text-[11px] font-medium text-bad">{errors[`${id}.reason`]}</div>}
                        </>
                      ) : (
                        <span className="inline-block pt-2.5 text-[13px] text-ink-3">{variance === null ? "" : "Within tolerance"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong bg-canvas/60 text-sm">
                <td className="px-5 py-3 font-medium text-ink">
                  Total <span className="font-normal text-ink-3">({filled.length}/{data.rows.length} entered)</span>
                </td>
                <td className="num px-2 py-3 text-right text-ink-2">{totals.forecastAll}</td>
                <td className="num px-2 py-3 text-right text-ink">{totals.produced || "—"}</td>
                <td className="num px-2 py-3 text-right text-ink">{totals.served || "—"}</td>
                <td className="num px-2 py-3 text-right font-semibold text-ink">{filled.length ? totals.surplus : "—"}</td>
                <td className="num px-2 py-3 text-right text-ink">{filled.length ? totals.waste.toFixed(1) : "—"}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink-3">
            {errors.form ? (
              <span className="font-medium text-bad">{errors.form}</span>
            ) : Object.keys(errors).length ? (
              <span className="font-medium text-bad">Fix the highlighted fields.</span>
            ) : !canEdit ? (
              "Read-only for your role."
            ) : (
              "Only locations with a served count are saved. You can come back and complete the rest."
            )}
          </p>
          {canEdit && (
            <Button onClick={save} loading={busy}>
              <FloppyDisk size={17} weight="bold" /> Save results
            </Button>
          )}
        </div>
      </section>

      {saved && filled.length > 0 && (
        <section className="pop-in flex flex-col gap-4 rounded-[16px] border border-ok/20 bg-ok-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CheckCircle size={22} weight="fill" className="shrink-0 text-ok" />
            <div className="text-sm text-ok">
              <p className="font-semibold">
                Saved. Forecast {totals.forecast} vs served {totals.served} · surplus {totals.surplus} meals · {totals.waste.toFixed(1)} kg waste
              </p>
              <p className="mt-0.5">These results now feed the analytics and the historical adjustment for future forecasts.</p>
            </div>
          </div>
          <LinkButton href="/manager" variant="primary">
            See analytics <ArrowRight size={15} />
          </LinkButton>
        </section>
      )}
    </div>
  );
}
