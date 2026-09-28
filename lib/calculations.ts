import {
  addDays,
  minutesBetween,
  nextWorkingDay,
  previousWorkingDay,
  toStamp,
} from "./dates";
import type {
  ChangeLog,
  Confidence,
  Database,
  DemandRecord,
  DemandStatus,
  KitchenSnapshot,
  Location,
  LocationDemandView,
  Settings,
  SpecialCounts,
} from "./types";
import { SPECIAL_DIETS } from "./types";

export const HISTORY_WINDOW = 20; // observations used for the historical adjustment
export const MIN_OBSERVATIONS = 8; // below this, no adjustment is applied
export const WASTE_KG_PER_PORTION = 0.32;

export function emptySpecial(): SpecialCounts {
  return { lactoseFree: 0, glutenFree: 0, vegetarian: 0, allergy: 0 };
}

export function specialTotal(s: SpecialCounts): number {
  return SPECIAL_DIETS.reduce((sum, k) => sum + (s[k] || 0), 0);
}

export function getNow(settings: Settings): string {
  return settings.clockMode === "real" ? toStamp(new Date()) : settings.simulatedNow;
}

/** The next service day after "now" — the day the kitchen is planning for. */
export function getServiceDate(now: string): string {
  return nextWorkingDay(now.slice(0, 10));
}

export const PLANNING_DAYS = 7;

/** The service days a location can confirm: the next service day plus the following working days. */
export function planningDates(serviceDate: string, count = PLANNING_DAYS): string[] {
  const out = [serviceDate];
  while (out.length < count) out.push(nextWorkingDay(out[out.length - 1]));
  return out;
}

export function getDeadline(date: string, loc: Location, settings: Settings): string {
  return `${previousWorkingDay(date)}T${settings.deadlines[loc.type]}`;
}

export function resolveStatus(record: DemandRecord, deadline: string, now: string): DemandStatus {
  if (!record.confirmed) return now > deadline ? "missing" : "draft";
  if (record.changedAfterConfirm) return "changed";
  if (record.confirmedAt && record.confirmedAt > deadline) return "late";
  return "confirmed";
}

export function defaultRecord(date: string, loc: Location): DemandRecord {
  return {
    id: `${date}_${loc.id}`,
    date,
    locationId: loc.id,
    expectedCount: loc.normalCapacity,
    absenceCount: 0,
    specialCounts: emptySpecial(),
    confirmed: false,
    confirmedAt: null,
    updatedAt: null,
    updatedByRole: null,
    changedAfterConfirm: false,
  };
}

export function findRecord(db: Database, date: string, loc: Location): DemandRecord {
  return db.demand.find((r) => r.date === date && r.locationId === loc.id) ?? defaultRecord(date, loc);
}

/**
 * Historical adjustment: the average gap between meals actually served and the
 * confirmed diner count, over recent confirmed days. Only applied when enough
 * observations exist, and capped at 5 % so it can never dominate the forecast.
 */
export function historicalAdjustment(db: Database, loc: Location, beforeDate: string, net: number) {
  const obs: number[] = [];
  const plans = [...db.plans].filter((p) => p.date < beforeDate).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const p of plans) {
    if (obs.length >= HISTORY_WINDOW) break;
    const st = p.statuses[loc.id];
    if (st !== "confirmed" && st !== "changed") continue;
    const actual = db.actuals.find((a) => a.date === p.date && a.locationId === loc.id);
    const rec = db.demand.find((r) => r.date === p.date && r.locationId === loc.id);
    if (!actual || !rec) continue;
    // only count days where the kitchen produced enough — a shortage hides true demand
    if (actual.served >= actual.produced) continue;
    obs.push(actual.served - (rec.expectedCount - rec.absenceCount));
  }
  if (obs.length < MIN_OBSERVATIONS) return { value: 0, observations: obs.length };
  const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
  const cap = Math.max(1, Math.round(net * 0.05));
  const value = Math.max(-cap, Math.min(cap, Math.round(mean)));
  return { value, observations: obs.length };
}

/** Typical absences for a location, used only to estimate unconfirmed counts. */
export function typicalAbsences(db: Database, loc: Location, beforeDate: string): number {
  const recs = db.demand
    .filter((r) => r.locationId === loc.id && r.date < beforeDate && r.confirmed)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);
  if (recs.length === 0) return 0;
  return Math.round(recs.reduce((s, r) => s + r.absenceCount, 0) / recs.length);
}

function rowConfidence(status: DemandStatus): Confidence {
  if (status === "confirmed" || status === "changed") return "high";
  if (status === "late" || status === "draft") return "medium";
  return "low";
}

export function buildLocationView(
  db: Database,
  loc: Location,
  date: string,
  now: string,
): LocationDemandView {
  const settings = db.settings;
  const record = findRecord(db, date, loc);
  const deadline = getDeadline(date, loc, settings);
  const status = resolveStatus(record, deadline, now);

  let netDiners: number;
  let isEstimate = false;
  let estimateBasis: string | null = null;
  if (record.confirmed) {
    netDiners = record.expectedCount - record.absenceCount;
  } else {
    const typical = typicalAbsences(db, loc, date);
    netDiners = record.expectedCount - typical;
    isEstimate = true;
    estimateBasis = `${record.expectedCount} registered − ~${typical} typical absences (4-week average)`;
  }

  const adj = settings.useHistoricalAdjustment
    ? historicalAdjustment(db, loc, date, netDiners)
    : { value: 0, observations: 0 };
  const forecast = Math.max(0, netDiners + adj.value);
  const buffer = Math.round((forecast * settings.bufferPercent) / 100);
  const logs = db.changeLog
    .filter((c) => c.recordId === record.id)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    location: loc,
    record,
    status,
    deadline,
    minutesToDeadline: minutesBetween(now, deadline),
    netDiners,
    isEstimate,
    estimateBasis,
    historicalAdjustment: adj.value,
    historyObservations: adj.observations,
    forecast,
    buffer,
    recommended: forecast + buffer,
    confidence: rowConfidence(status),
    specialTotal: specialTotal(record.specialCounts),
    lastChange: logs[0] ?? null,
  };
}

const signed = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);

export function explainRow(v: LocationDemandView, bufferPercent: number): string {
  const base = v.isEstimate
    ? `${v.record.expectedCount} registered − ~${v.record.expectedCount - v.netDiners} estimated absences`
    : `${v.record.expectedCount} expected − ${v.record.absenceCount} confirmed absences`;
  return `Recommended ${v.recommended} meals: ${base} ${signed(v.historicalAdjustment)} historical adjustment + ${v.buffer} buffer (${bufferPercent} %).`;
}

export function buildSnapshot(db: Database, dateOverride?: string): KitchenSnapshot {
  const now = getNow(db.settings);
  const serviceDate = dateOverride ?? getServiceDate(now);
  const rows = db.locations.map((loc) => buildLocationView(db, loc, serviceDate, now));

  const counts: Record<DemandStatus, number> = { draft: 0, confirmed: 0, changed: 0, late: 0, missing: 0 };
  const special = emptySpecial();
  let expectedPopulation = 0,
    absences = 0,
    netDiners = 0,
    confirmedDiners = 0,
    estimatedDiners = 0,
    adjustment = 0,
    buffer = 0,
    recommended = 0;

  for (const r of rows) {
    counts[r.status]++;
    expectedPopulation += r.record.expectedCount;
    absences += r.record.expectedCount - r.netDiners;
    netDiners += r.netDiners;
    if (r.isEstimate) estimatedDiners += r.netDiners;
    else confirmedDiners += r.netDiners;
    adjustment += r.historicalAdjustment;
    buffer += r.buffer;
    recommended += r.recommended;
    for (const k of SPECIAL_DIETS) special[k] += r.record.specialCounts[k] || 0;
  }

  const estimatedShare = netDiners === 0 ? 0 : estimatedDiners / netDiners;
  let confidence: Confidence = "high";
  if (counts.missing > 0 && estimatedShare > 0.2) confidence = "low";
  else if (counts.missing > 0 || counts.draft > 0 || counts.late > 0) confidence = "medium";

  const estimatedAbs = rows.filter((r) => r.isEstimate).reduce((s, r) => s + (r.record.expectedCount - r.netDiners), 0);
  const explanation =
    `Recommended ${recommended} meals: ${expectedPopulation} expected − ${absences} absences` +
    (estimatedAbs > 0 ? ` (${estimatedAbs} of them estimated)` : "") +
    ` ${signed(adjustment)} historical adjustment + ${buffer} buffer (${db.settings.bufferPercent} %).`;

  return {
    now,
    serviceDate,
    meal: db.mealPlans.find((m) => m.date === serviceDate) ?? null,
    rows,
    totals: {
      expectedPopulation,
      absences,
      netDiners,
      confirmedDiners,
      estimatedDiners,
      adjustment,
      buffer,
      recommended,
      special,
    },
    counts,
    confidence,
    explanation,
    plan: db.plans.find((p) => p.date === serviceDate) ?? null,
    settings: db.settings,
  };
}

/** Distribute an approved total across locations in proportion to their recommendation. */
export function allocate(rows: LocationDemandView[], total: number): Record<string, number> {
  const rec = rows.reduce((s, r) => s + r.recommended, 0);
  const out: Record<string, number> = {};
  if (rec === 0) {
    rows.forEach((r) => (out[r.location.id] = 0));
    return out;
  }
  const raw = rows.map((r) => ({ id: r.location.id, exact: (r.recommended / rec) * total }));
  let assigned = 0;
  raw.forEach((r) => {
    out[r.id] = Math.floor(r.exact);
    assigned += out[r.id];
  });
  raw
    .sort((a, b) => (b.exact % 1) - (a.exact % 1))
    .slice(0, total - assigned)
    .forEach((r) => out[r.id]++);
  return out;
}

export function isMaterialChange(
  prev: { expected: number; absences: number },
  next: { expected: number; absences: number },
  threshold: number,
) {
  return Math.abs(prev.expected - prev.absences - (next.expected - next.absences)) > threshold;
}

export function varianceNeedsReason(forecast: number, served: number, pct: number) {
  const limit = Math.max(3, Math.round((forecast * pct) / 100));
  return Math.abs(forecast - served) > limit;
}

/* ---------------- Analytics ---------------- */

export interface AnalyticsRow {
  date: string;
  locationId: string;
  forecast: number;
  produced: number;
  served: number;
  surplus: number;
  wasteKg: number;
  status: DemandStatus;
  reason: string | null;
}

export function analyticsRows(db: Database, days: number, locationId?: string | null): AnalyticsRow[] {
  const dates = [...new Set(db.actuals.map((a) => a.date))].sort().slice(-days);
  const rows: AnalyticsRow[] = [];
  for (const a of db.actuals) {
    if (!dates.includes(a.date)) continue;
    if (locationId && a.locationId !== locationId) continue;
    const plan = db.plans.find((p) => p.date === a.date);
    if (!plan) continue;
    rows.push({
      date: a.date,
      locationId: a.locationId,
      forecast: plan.forecasts[a.locationId] ?? a.produced,
      produced: a.produced,
      served: a.served,
      surplus: a.surplus,
      wasteKg: a.wasteKg,
      status: plan.statuses[a.locationId] ?? "confirmed",
      reason: a.reason,
    });
  }
  return rows.sort((x, y) => (x.date < y.date ? -1 : 1));
}

export function buildAnalytics(db: Database, days: number, locationId?: string | null) {
  const rows = analyticsRows(db, days, locationId);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const served = sum(rows.map((r) => r.served));
  const absErr = sum(rows.map((r) => Math.abs(r.forecast - r.served)));
  const dates = [...new Set(rows.map((r) => r.date))];
  const nDays = Math.max(1, dates.length);
  const late = rows.filter((r) => r.status === "late" || r.status === "missing");
  const onTime = rows.filter((r) => r.status !== "late" && r.status !== "missing");
  const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
  const surplusPer = (arr: AnalyticsRow[]) => avg(arr.map((r) => r.surplus));
  const produced = sum(rows.map((r) => r.produced));
  const surplus = sum(rows.map((r) => r.surplus));

  // Daily totals only make sense for fully recorded days; partial days would look like a collapse in demand.
  const expectedPerDay = locationId ? 1 : db.locations.length;
  const completeDates = dates.filter((d) => rows.filter((r) => r.date === d).length >= expectedPerDay);
  const daily = completeDates.map((d) => {
    const dr = rows.filter((r) => r.date === d);
    return {
      date: d,
      forecast: sum(dr.map((r) => r.forecast)),
      produced: sum(dr.map((r) => r.produced)),
      served: sum(dr.map((r) => r.served)),
      surplus: sum(dr.map((r) => r.surplus)),
      wasteKg: +sum(dr.map((r) => r.wasteKg)).toFixed(1),
      lateCount: dr.filter((r) => r.status === "late" || r.status === "missing").length,
    };
  });

  const byLocation = db.locations
    .filter((l) => !locationId || l.id === locationId)
    .map((l) => {
      const lr = rows.filter((r) => r.locationId === l.id);
      const lServed = sum(lr.map((r) => r.served));
      const lProduced = sum(lr.map((r) => r.produced));
      const lSurplus = sum(lr.map((r) => r.surplus));
      const lLate = lr.filter((r) => r.status === "late" || r.status === "missing").length;
      return {
        id: l.id,
        name: l.name,
        type: l.type,
        days: lr.length,
        accuracy: lServed ? 100 * (1 - sum(lr.map((r) => Math.abs(r.forecast - r.served))) / lServed) : 0,
        avgVariance: avg(lr.map((r) => r.forecast - r.served)),
        avgAbsVariance: avg(lr.map((r) => Math.abs(r.forecast - r.served))),
        surplusRate: lProduced ? (100 * lSurplus) / lProduced : 0,
        avgSurplus: avg(lr.map((r) => r.surplus)),
        wasteKg: sum(lr.map((r) => r.wasteKg)),
        lateRate: lr.length ? (100 * lLate) / lr.length : 0,
        topReason: topOf(lr.map((r) => r.reason).filter(Boolean) as string[]),
      };
    });

  const reasonCounts: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.reason) reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  });
  const reasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const lateSurplus = surplusPer(late);
  const onTimeSurplus = surplusPer(onTime);

  return {
    period: {
      days: nDays,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      partialDays: dates.filter((d) => !completeDates.includes(d)),
    },
    kpis: {
      accuracy: served ? 100 * (1 - absErr / served) : 0,
      avgAbsVariancePerDay: absErr / nDays,
      bias: avg(rows.map((r) => r.forecast - r.served)),
      avgSurplusPerDay: surplus / nDays,
      surplusRate: produced ? (100 * surplus) / produced : 0,
      avgWastePerDay: sum(rows.map((r) => r.wasteKg)) / nDays,
      lateRate: rows.length ? (100 * late.length) / rows.length : 0,
      totalServed: served,
    },
    insight: {
      lateSurplus,
      onTimeSurplus,
      ratio: onTimeSurplus > 0 ? lateSurplus / onTimeSurplus : 0,
      lateShareOfSurplus: surplus ? (100 * sum(late.map((r) => r.surplus))) / surplus : 0,
      lateShareOfRows: rows.length ? (100 * late.length) / rows.length : 0,
    },
    daily,
    byLocation,
    reasons,
  };
}

function topOf(arr: string[]): string | null {
  const c: Record<string, number> = {};
  arr.forEach((a) => (c[a] = (c[a] || 0) + 1));
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

export type Analytics = ReturnType<typeof buildAnalytics>;

export function changeHistory(db: Database, locationId: string): ChangeLog[] {
  return db.changeLog
    .filter((c) => c.locationId === locationId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export { addDays };
