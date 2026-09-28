"use client";

import { ArrowsClockwise, CheckCircle, PencilSimpleLine, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { DIET_LABEL } from "@/lib/labels";
import { fmtStamp } from "@/lib/dates";
import type { ChangeLog, KitchenSnapshot } from "@/lib/types";
import { SPECIAL_DIETS } from "@/lib/types";
import { apiPost, ClientApiError, useSession, useToast } from "./providers";
import { Button, ConfidenceBadge, Field, inputCls, Stepper, cx } from "./ui";

export type RecommendationData = KitchenSnapshot & { changesSinceApproval: ChangeLog[] };

const sign = (n: number) => (n < 0 ? "−" : "+");

export function Rationale({ snap }: { snap: KitchenSnapshot }) {
  const t = snap.totals;
  const estAbs = snap.rows.filter((r) => r.isEstimate).reduce((s, r) => s + (r.record.expectedCount - r.netDiners), 0);
  const lines: { label: string; hint?: string; value: string; strong?: boolean }[] = [
    { label: "Expected population", hint: `${snap.rows.length} locations`, value: String(t.expectedPopulation) },
    {
      label: "Absences",
      hint: estAbs > 0 ? `${t.absences - estAbs} confirmed · ${estAbs} estimated` : "all confirmed",
      value: `− ${t.absences}`,
    },
    {
      label: "Historical adjustment",
      hint: snap.settings.useHistoricalAdjustment ? "served vs. confirmed, recent days" : "switched off",
      value: `${sign(t.adjustment)} ${Math.abs(t.adjustment)}`,
    },
    { label: "Operational buffer", hint: `${snap.settings.bufferPercent} % of forecast`, value: `+ ${t.buffer}` },
  ];
  return (
    <dl className="flex flex-col">
      {lines.map((l) => (
        <div key={l.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2">
          <dt className="min-w-0">
            <span className="text-sm text-ink">{l.label}</span>
            {l.hint && <span className="block text-xs text-ink-3">{l.hint}</span>}
          </dt>
          <dd className="num shrink-0 text-[15px] text-ink">{l.value}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 pt-2.5">
        <dt className="text-sm font-semibold text-ink">Recommended</dt>
        <dd className="num text-[15px] font-semibold text-ink">= {t.recommended}</dd>
      </div>
    </dl>
  );
}

export function SpecialBreakdown({ snap }: { snap: KitchenSnapshot }) {
  const sp = snap.totals.special;
  const total = SPECIAL_DIETS.reduce((s, k) => s + sp[k], 0);
  if (total === 0) return null;
  return (
    <div className="rounded-xl bg-canvas/70 p-3.5">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink-2">Special meals within the total</span>
        <span className="num font-medium text-ink">{total}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        {SPECIAL_DIETS.map((k) => (
          <div key={k} className="flex justify-between">
            <dt className="text-ink-3">{DIET_LABEL[k]}</dt>
            <dd className="num text-ink-2">{sp[k]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-3">Confirmed locations only. Production of special diets is planned separately.</p>
    </div>
  );
}

export function ApprovalPanel({ snap, compact }: { snap: RecommendationData; compact?: boolean }) {
  const { role } = useSession();
  const toast = useToast();
  const canApprove = role === "kitchen" || role === "admin";
  const rec = snap.totals.recommended;
  const [mode, setMode] = useState<"idle" | "adjust">("idle");
  const [total, setTotal] = useState(rec);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const plan = snap.plan;
  const drift = plan ? rec - plan.totalRecommended : 0;
  const stale = !!plan && (drift !== 0 || snap.changesSinceApproval.length > 0);

  const approve = async (value: number) => {
    setBusy(true);
    setErr(null);
    try {
      await apiPost("/api/production/approve", { total: value, reason: value === rec ? null : reason, approvedBy: "Minna Rautio (kitchen)" });
      toast({ title: `Production approved: ${value} meals`, body: value === rec ? "Recommendation accepted" : `Adjusted from ${rec}`, tone: "ok" });
      setMode("idle");
      setReason("");
    } catch (e) {
      const ce = e as ClientApiError;
      setErr({ msg: ce.message, field: ce.field });
    } finally {
      setBusy(false);
    }
  };

  const diff = total - rec;

  return (
    <div className="flex flex-col gap-3">
      {plan && (
        <div className={cx("rounded-xl border px-3.5 py-3 text-sm", stale ? "border-warn/25 bg-warn-soft" : "border-ok/20 bg-ok-soft")}>
          <div className={cx("flex items-center gap-2 font-medium", stale ? "text-warn" : "text-ok")}>
            {stale ? <Warning size={17} weight="bold" /> : <CheckCircle size={17} weight="bold" />}
            {stale ? "Demand changed after approval" : "Production approved"}
          </div>
          <p className={cx("mt-1 text-[13px]", stale ? "text-warn" : "text-ok")}>
            <span className="num font-semibold">{plan.totalApproved}</span> meals by {plan.approvedBy.replace(" (kitchen)", "")},{" "}
            {fmtStamp(plan.approvedAt)}
            {plan.adjustmentReason && <> · adjusted from {plan.totalRecommended}: “{plan.adjustmentReason}”</>}
          </p>
          {stale && (
            <p className="mt-1 text-[13px] text-warn">
              {snap.changesSinceApproval.length} update{snap.changesSinceApproval.length === 1 ? "" : "s"} since then — the
              recommendation is now <span className="num font-semibold">{rec}</span> ({drift >= 0 ? "+" : "−"}
              {Math.abs(drift)}).
            </p>
          )}
        </div>
      )}

      {!canApprove ? (
        <p className="rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-ink-2">
          Read-only for your role. The kitchen approves or adjusts production — the system never changes quantities on its own.
        </p>
      ) : mode === "idle" ? (
        (!plan || stale) && (
          <div className={cx("flex gap-2", compact ? "flex-col" : "flex-col sm:flex-row")}>
            <Button className="flex-1" onClick={() => approve(rec)} loading={busy}>
              {plan ? <ArrowsClockwise size={17} weight="bold" /> : <CheckCircle size={17} weight="bold" />}
              {plan ? `Re-approve ${rec}` : `Approve ${rec} meals`}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setTotal(rec);
                setMode("adjust");
              }}
            >
              <PencilSimpleLine size={17} /> Adjust
            </Button>
          </div>
        )
      ) : (
        <div className="fade-in flex flex-col gap-3 rounded-xl border border-line p-3.5">
          <Field label="Approved quantity" help={diff === 0 ? "Same as the recommendation" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs. recommendation`}>
            <Stepper big label="approved quantity" value={total} onChange={setTotal} max={Math.round(rec * 1.5)} />
          </Field>
          {diff !== 0 && (
            <Field label="Reason for adjusting" htmlFor="adj-reason" error={err?.field === "reason" ? err.msg : null}>
              <input
                id="adj-reason"
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={err?.field === "reason" || undefined}
                placeholder="e.g. Popular menu, sports day"
              />
            </Field>
          )}
          {err && err.field !== "reason" && <p className="text-[13px] font-medium text-bad">{err.msg}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => approve(total)} loading={busy}>
              Approve {total}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecommendationCard({ snap }: { snap: RecommendationData }) {
  return (
    <section className="card flex flex-col gap-5 p-5" aria-labelledby="rec-title">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 id="rec-title" className="text-sm font-medium text-ink-2">
            Recommended production
          </h2>
          <ConfidenceBadge level={snap.confidence} />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-[52px] font-semibold leading-none tracking-[-0.045em] text-ink">{snap.totals.recommended}</span>
          <span className="text-sm text-ink-3">meals</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{snap.explanation}</p>
      </div>
      <Rationale snap={snap} />
      <SpecialBreakdown snap={snap} />
      <ApprovalPanel snap={snap} compact />
    </section>
  );
}
