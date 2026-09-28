"use client";

import { ArrowCounterClockwise, Plus, FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { apiPost, ClientApiError, useApi, useSession, useToast } from "@/components/providers";
import { Button, ErrorState, Field, inputCls, PageHeader, PageSkeleton, cx, selectCls } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/labels";
import type { Location, LocationType, Settings } from "@/lib/types";

interface Resp {
  settings: Settings;
  now: string;
  serviceDate: string;
  locations: Location[];
}

export default function SettingsPage() {
  const { data, error, reload } = useApi<Resp>("/api/settings");
  const { role } = useSession();
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const canConfigure = role === "manager" || role === "admin";

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-6">
      <PageHeader eyebrow="Settings · demo configuration" title="Rules and demo data">
        Deadlines, buffer and thresholds are the business rules behind every status and recommendation. They are assumptions
        to validate with food-service staff — not known values.
      </PageHeader>
      {!canConfigure && (
        <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-ink-2">
          Read-only for your role. Switch to Manager or Demo admin in the top bar to change settings.
        </p>
      )}
      <RulesForm key={JSON.stringify(data.settings)} s={data.settings} disabled={!canConfigure} />
      <LocationsAdmin locations={data.locations} disabled={role !== "admin"} />
      <DemoData now={data.now} serviceDate={data.serviceDate} disabled={!canConfigure} />
    </div>
  );
}

function Section({ title, sub, children, i }: { title: string; sub: string; children: React.ReactNode; i: number }) {
  return (
    <section className="card rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function RulesForm({ s, disabled }: { s: Settings; disabled: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState({
    daycare: s.deadlines.daycare,
    school: s.deadlines.school,
    bufferPercent: String(s.bufferPercent),
    materialChangeThreshold: String(s.materialChangeThreshold),
    varianceThreshold: String(s.varianceThreshold),
    useHistoricalAdjustment: s.useHistoricalAdjustment,
  });
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setErr(null), [form]);

  const save = async () => {
    setBusy(true);
    try {
      await apiPost("/api/settings", {
        deadlines: { daycare: form.daycare, school: form.school },
        bufferPercent: Number(form.bufferPercent),
        materialChangeThreshold: Number(form.materialChangeThreshold),
        varianceThreshold: Number(form.varianceThreshold),
        useHistoricalAdjustment: form.useHistoricalAdjustment,
      });
      toast({ title: "Rules saved", body: "Statuses and recommendations recalculated", tone: "ok" });
    } catch (e) {
      const ce = e as ClientApiError;
      setErr({ field: ce.field, msg: ce.message });
    } finally {
      setBusy(false);
    }
  };
  const fe = (f: string) => (err?.field === f ? err.msg : null);

  return (
    <Section i={1} title="Demand rules" sub="Applied immediately to every location's status and to the recommendation.">
      <fieldset disabled={disabled} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Day-care confirmation deadline" help="Previous working day" error={fe("deadlines.daycare")} htmlFor="dl-d">
          <input id="dl-d" type="time" className={inputCls} value={form.daycare} onChange={(e) => setForm({ ...form, daycare: e.target.value })} />
        </Field>
        <Field label="School confirmation deadline" help="Previous working day" error={fe("deadlines.school")} htmlFor="dl-s">
          <input id="dl-s" type="time" className={inputCls} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
        </Field>
        <Field label="Operational buffer (%)" help="Added on top of the forecast to protect service. 0–15 %." error={fe("bufferPercent")} htmlFor="buf">
          <input id="buf" inputMode="numeric" className={inputCls} value={form.bufferPercent} onChange={(e) => setForm({ ...form, bufferPercent: e.target.value })} />
        </Field>
        <Field
          label="Material change threshold (meals)"
          help="Corrections larger than this require a reason."
          error={fe("materialChangeThreshold")}
          htmlFor="mct"
        >
          <input id="mct" inputMode="numeric" className={inputCls} value={form.materialChangeThreshold} onChange={(e) => setForm({ ...form, materialChangeThreshold: e.target.value })} />
        </Field>
        <Field
          label="Variance threshold (% of forecast)"
          help="Post-service gaps larger than this need a variance reason."
          error={fe("varianceThreshold")}
          htmlFor="vt"
        >
          <input id="vt" inputMode="numeric" className={inputCls} value={form.varianceThreshold} onChange={(e) => setForm({ ...form, varianceThreshold: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Historical adjustment</span>
          <label className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-line-strong px-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-accent)]"
              checked={form.useHistoricalAdjustment}
              onChange={(e) => setForm({ ...form, useHistoricalAdjustment: e.target.checked })}
            />
            <span className="text-[15px] text-ink">Apply learned gap between confirmed and served</span>
          </label>
          <p className="text-[13px] text-ink-3">Needs 8+ confirmed days; capped at 5 %.</p>
        </div>
      </fieldset>
      {err && !err.field && <p className="mt-4 text-sm font-medium text-bad">{err.msg}</p>}
      {!disabled && (
        <div className="mt-6 flex justify-end">
          <Button onClick={save} loading={busy}>
            <FloppyDisk size={17} weight="bold" /> Save rules
          </Button>
        </div>
      )}
    </Section>
  );
}

function LocationsAdmin({ locations, disabled }: { locations: Location[]; disabled: boolean }) {
  const toast = useToast();
  const blank = { id: "", name: "", type: "school" as LocationType, normalCapacity: "", contact: "" };
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setErr(null);
    try {
      await apiPost("/api/admin/locations", { ...edit, id: edit.id || undefined, normalCapacity: Number(edit.normalCapacity) });
      toast({ title: edit.id ? "Location updated" : "Location added", body: edit.name, tone: "ok" });
      setEdit(null);
    } catch (e) {
      const ce = e as ClientApiError;
      setErr({ field: ce.field, msg: ce.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section i={2} title="Locations" sub="Fictional demo locations. Only the demo admin can add or edit them.">
      <ul className="-mx-5 divide-y divide-line border-y border-line sm:-mx-6">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-ink">{l.name}</div>
              <div className="text-[13px] text-ink-3">
                {TYPE_LABEL[l.type]} · {l.contact}
              </div>
            </div>
            <div className="num text-sm text-ink-2">{l.normalCapacity}</div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEdit({ id: l.id, name: l.name, type: l.type, normalCapacity: String(l.normalCapacity), contact: l.contact })}
              >
                Edit
              </Button>
            )}
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="fade-in mt-5 grid grid-cols-1 gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Field label="Name" error={err?.field === "name" ? err.msg : null} htmlFor="ln">
            <input id="ln" className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Päiväkoti Kanerva" />
          </Field>
          <Field label="Type" htmlFor="lt">
            <select id="lt" className={cx(selectCls, "h-11")} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as LocationType })}>
              <option value="school">School</option>
              <option value="daycare">Day-care</option>
            </select>
          </Field>
          <Field label="Normal capacity (diners)" error={err?.field === "normalCapacity" ? err.msg : null} htmlFor="lc">
            <input id="lc" inputMode="numeric" className={inputCls} value={edit.normalCapacity} onChange={(e) => setEdit({ ...edit, normalCapacity: e.target.value })} />
          </Field>
          <Field label="Contact person" htmlFor="lp">
            <input id="lp" className={inputCls} value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} />
          </Field>
          {err && !err.field && <p className="text-sm font-medium text-bad sm:col-span-2">{err.msg}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {edit.id ? "Save location" : "Add location"}
            </Button>
          </div>
        </div>
      ) : (
        !disabled && (
          <Button variant="secondary" className="mt-5" onClick={() => setEdit(blank)}>
            <Plus size={16} weight="bold" /> Add location
          </Button>
        )
      )}
    </Section>
  );
}

function DemoData({ now, serviceDate, disabled }: { now: string; serviceDate: string; disabled: boolean }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ days: number }>("/api/admin/reset", {});
      toast({ title: "Demo data reset", body: `${r.days} days of synthetic history regenerated`, tone: "ok" });
      setConfirming(false);
    } catch (e) {
      toast({ title: "Reset failed", body: (e as Error).message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section i={3} title="Demo data" sub="Synthetic, deterministic data: 8 fictional locations and 30 service days of history.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-2">
          Clock: <span className="num font-medium text-ink">{fmtDate(now)} {fmtTime(now)}</span> · planning{" "}
          <span className="font-medium text-ink">{fmtDate(serviceDate, true)}</span>. Resetting restores the starting scenario
          of the demo story and discards every change made since.
        </p>
        {!disabled &&
          (confirming ? (
            <div className="fade-in flex shrink-0 gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Keep data
              </Button>
              <Button variant="danger" onClick={reset} loading={busy}>
                Yes, reset
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="shrink-0" onClick={() => setConfirming(true)}>
              <ArrowCounterClockwise size={16} weight="bold" /> Reset demo data
            </Button>
          ))}
      </div>
    </Section>
  );
}
