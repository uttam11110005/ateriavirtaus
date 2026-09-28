// Synthetic, deterministic demo data. All locations and people are fictional.
import { emptySpecial, varianceNeedsReason, WASTE_KG_PER_PORTION } from "./calculations";
import { addDays, nextWorkingDay, parseDate, previousWorkingDay, toDateStr, workingDaysBefore } from "./dates";
import type {
  ChangeLog,
  Database,
  DemandRecord,
  DemandStatus,
  Location,
  MealPlan,
  ProductionPlan,
  ServiceActual,
  Settings,
  SpecialCounts,
  VarianceReason,
} from "./types";

export const DB_VERSION = 7;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  late: number;
  missing: number;
  changed: number;
  unreported: number; // share of diners who are absent but never reported
  absence: number; // base absence rate
  tripChance: number;
}

export const DEMO_LOCATIONS: (Location & { profile: Profile })[] = [
  { id: "harju", name: "Harjurinteen koulu", type: "school", normalCapacity: 300, contact: "Riikka Halonen",
    profile: { late: 0.05, missing: 0.02, changed: 0.1, unreported: 0.012, absence: 0.072, tripChance: 0.05 } },
  { id: "koivu", name: "Koivulahden koulu", type: "school", normalCapacity: 420, contact: "Tapio Nurmela",
    profile: { late: 0.06, missing: 0.02, changed: 0.12, unreported: 0.01, absence: 0.064, tripChance: 0.06 } },
  { id: "satama", name: "Satamakadun koulu", type: "school", normalCapacity: 240, contact: "Elina Vartiainen",
    profile: { late: 0.3, missing: 0.13, changed: 0.05, unreported: 0.021, absence: 0.081, tripChance: 0.09 } },
  { id: "lumi", name: "Lumikallion koulu", type: "school", normalCapacity: 360, contact: "Jussi Kärkkäinen",
    profile: { late: 0.08, missing: 0.03, changed: 0.14, unreported: 0.011, absence: 0.069, tripChance: 0.07 } },
  { id: "paiva", name: "Päiväkoti Päivänsäde", type: "daycare", normalCapacity: 68, contact: "Hanna Leskinen",
    profile: { late: 0.03, missing: 0.01, changed: 0.15, unreported: 0.015, absence: 0.12, tripChance: 0.02 } },
  { id: "kielo", name: "Päiväkoti Kielo", type: "daycare", normalCapacity: 54, contact: "Marjut Heiskanen",
    profile: { late: 0.08, missing: 0.04, changed: 0.12, unreported: 0.018, absence: 0.13, tripChance: 0.02 } },
  { id: "tuuli", name: "Päiväkoti Tuulenpesä", type: "daycare", normalCapacity: 82, contact: "Oskari Hyvönen",
    profile: { late: 0.27, missing: 0.16, changed: 0.06, unreported: 0.03, absence: 0.14, tripChance: 0.05 } },
  { id: "mustikka", name: "Päiväkoti Mustikka", type: "daycare", normalCapacity: 46, contact: "Laura Pirinen",
    profile: { late: 0.15, missing: 0.05, changed: 0.1, unreported: 0.02, absence: 0.12, tripChance: 0.02 } },
];

const MENU = [
  "Meatballs, mashed potatoes & lingonberry",
  "Lentil and root-vegetable bolognese",
  "Salmon soup with rye bread",
  "Chicken curry with brown rice",
  "Oven-baked pollock, dill potatoes",
  "Macaroni casserole & grated carrot salad",
  "Broccoli-cheese soup, wholegrain bread",
  "Karelian stew with boiled potatoes",
  "Tofu and vegetable wok with noodles",
];

export const DEFAULT_SETTINGS = (simulatedNow: string): Settings => ({
  deadlines: { daycare: "22:00", school: "22:00" },
  bufferPercent: 2,
  materialChangeThreshold: 10,
  varianceThreshold: 3,
  useHistoricalAdjustment: true,
  clockMode: "real",
  simulatedNow,
});

const KITCHEN_USER = "Minna Rautio (kitchen)";

const pad = (n: number) => String(n).padStart(2, "0");
function stampAt(date: string, minutesOfDay: number) {
  // Late confirmations after a 22:00 deadline roll over past midnight.
  if (minutesOfDay >= 1440) return stampAt(addDays(date, 1), minutesOfDay - 1440);
  const h = Math.floor(minutesOfDay / 60);
  const m = Math.floor(minutesOfDay % 60);
  return `${date}T${pad(h)}:${pad(m)}`;
}
const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

function mealFor(date: string, i: number): MealPlan {
  const d = parseDate(date);
  // Thursday is pea soup & pancake day in Finnish schools.
  const mealName = d.getDay() === 4 ? "Pea soup with oven pancake & berry jam" : MENU[i % MENU.length];
  return { date, mealName };
}

function specials(loc: Location, diners: number, rnd: () => number): SpecialCounts {
  const s = emptySpecial();
  const f = diners / 100;
  s.lactoseFree = Math.round(f * (3 + rnd() * 1.5));
  s.glutenFree = Math.round(f * (1.2 + rnd() * 0.8));
  s.vegetarian = Math.round(f * (loc.type === "school" ? 6 + rnd() * 3 : 3 + rnd() * 2));
  s.allergy = Math.round(f * (0.8 + rnd() * 0.8));
  return s;
}

export function createSeed(realNow = new Date()): Database {
  const rnd = mulberry32(20260927);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;

  // The simulated "today" is the working day before the next service day.
  const serviceDate = nextWorkingDay(toDateStr(realNow));
  const today = previousWorkingDay(serviceDate);
  const simulatedNow = `${today}T11:15`;
  const settings = DEFAULT_SETTINGS(simulatedNow);

  const historyDates = workingDaysBefore(today, 30);
  const plannedDates = [...historyDates, today]; // today: planned & served, actuals not yet entered

  const locations: Location[] = DEMO_LOCATIONS.map(({ profile: _p, ...l }) => l);
  const demand: DemandRecord[] = [];
  const changeLog: ChangeLog[] = [];
  const plans: ProductionPlan[] = [];
  const actuals: ServiceActual[] = [];

  const mealPlans: MealPlan[] = [];
  let d = historyDates[0];
  for (let i = 0; i < 44; i++) {
    mealPlans.push(mealFor(d, i));
    d = nextWorkingDay(d);
  }

  plannedDates.forEach((date, dayIndex) => {
    const weekday = parseDate(date).getDay();
    const fluWave = dayIndex > plannedDates.length - 9 ? 0.025 : 0;
    const weekdayEffect = weekday === 1 ? 0.01 : weekday === 5 ? 0.022 : 0;
    const deadlineDay = previousWorkingDay(date);
    const menu = mealPlans.find((m) => m.date === date)?.mealName ?? "";
    // Some dishes are less popular: fewer pupils take lunch even when present.
    const menuEffect = /pollock|tofu/i.test(menu) && rnd() < 0.6 ? 0.015 + rnd() * 0.02 : 0;

    const plan: ProductionPlan = {
      date,
      totalRecommended: 0,
      totalApproved: 0,
      adjustmentReason: null,
      approvedBy: KITCHEN_USER,
      approvedAt: stampAt(date, hm("06:30") + Math.floor(rnd() * 25)),
      allocations: {},
      forecasts: {},
      statuses: {},
    };

    for (const full of DEMO_LOCATIONS) {
      const { profile: p, ...loc } = full;
      const deadlineMin = hm(settings.deadlines[loc.type]);
      const cap = loc.normalCapacity;
      const roll = rnd();
      const status: DemandStatus =
        roll < p.missing ? "missing" : roll < p.missing + p.late ? "late" : roll < p.missing + p.late + p.changed ? "changed" : "confirmed";
      const lateInfo = status === "late" || status === "missing";

      // Late or missing confirmations tend to coincide with the information the kitchen most needed:
      // trips, sudden absence waves. That is the hypothesis the analytics view lets a manager test.
      const tripP = lateInfo ? p.tripChance * 3 : p.tripChance;
      const trip = rnd() < tripP ? Math.round(cap * (loc.type === "school" ? 0.07 + rnd() * 0.04 : 0.15)) : 0;
      const wave = lateInfo ? cap * (0.015 + rnd() * 0.045) : 0;
      const trueAbs = Math.max(0, Math.round(cap * (p.absence + weekdayEffect + fluWave) + wave + gauss() * Math.sqrt(cap) * 0.6));
      const extra = rnd() < 0.03 ? Math.round(cap * 0.04) : 0; // e.g. visiting group nobody reported
      const attending = cap - trip - trueAbs + extra;

      const unreported = Math.round(cap * p.unreported * 0.5 * (0.5 + rnd()) * (rnd() < 0.08 ? 5 : 1));
      const reportedAbs = Math.max(0, trueAbs - unreported);
      const expectedCount = cap - trip;
      const typical = Math.round(cap * p.absence);
      const estimate = cap - typical; // what the kitchen falls back to without a confirmation
      const knownNet = expectedCount - reportedAbs;

      const record: DemandRecord = {
        id: `${date}_${loc.id}`,
        date,
        locationId: loc.id,
        expectedCount,
        absenceCount: reportedAbs,
        specialCounts: specials(loc, knownNet, rnd),
        confirmed: status !== "missing",
        confirmedAt: null,
        updatedAt: null,
        updatedByRole: "location",
        changedAfterConfirm: status === "changed",
      };
      if (status === "missing") {
        record.expectedCount = cap;
        record.absenceCount = 0;
      } else if (status === "late") {
        record.confirmedAt = stampAt(deadlineDay, deadlineMin + 12 + rnd() * 150);
      } else {
        record.confirmedAt = stampAt(deadlineDay, deadlineMin - 30 - rnd() * 170);
      }
      record.updatedAt = record.confirmedAt;

      if (lateInfo) {
        changeLog.push({
          id: `cl_${record.id}_c`,
          recordId: record.id,
          date,
          locationId: loc.id,
          field: "confirm",
          previousValue: null,
          newValue: { expected: record.expectedCount, absences: record.absenceCount },
          reason: null,
          timestamp: record.confirmedAt ?? stampAt(deadlineDay, deadlineMin + 1),
          role: "location",
          afterDeadline: true,
        });
      }
      if (status === "changed") {
        const before = { expected: cap, absences: Math.max(0, reportedAbs - Math.round(4 + rnd() * 8)) };
        const ts = stampAt(deadlineDay, deadlineMin - 5 - rnd() * 25);
        record.updatedAt = ts;
        changeLog.push({
          id: `cl_${record.id}_x`,
          recordId: record.id,
          date,
          locationId: loc.id,
          field: "count",
          previousValue: before,
          newValue: { expected: record.expectedCount, absences: record.absenceCount },
          reason: trip ? "Class trip added to calendar" : "More absences reported this morning",
          timestamp: ts,
          role: "location",
          afterDeadline: false,
        });
      }
      // The plan uses the confirmed count when it arrived in time, otherwise an estimate.
      const usedConfirmed = status === "confirmed" || status === "changed";
      const adj = dayIndex >= 8 ? -Math.round(cap * p.unreported * 0.5 + cap * 0.004) : 0;
      const forecast = (usedConfirmed ? knownNet : estimate) + adj;
      const buffer = Math.round(forecast * 0.02);
      const produced = forecast + buffer;
      const acceptance = 0.988 + rnd() * 0.012 - menuEffect;
      const served = Math.min(produced, Math.round(attending * acceptance));
      const surplus = produced - served;

      plan.statuses[loc.id] = status;
      plan.forecasts[loc.id] = forecast;
      plan.allocations[loc.id] = produced;
      plan.totalRecommended += produced;

      if (date !== today) {
        let reason: VarianceReason | null = null;
        if (varianceNeedsReason(forecast, served, settings.varianceThreshold)) {
          if (served >= produced) reason = "Unexpected extra diners";
          else if (lateInfo) reason = trip ? "Trip or event not reported" : "Late absence information";
          else if (unreported > cap * 0.012) reason = "Unreported absences";
          else if (menuEffect > 0) reason = "Menu acceptance";
          else reason = rnd() < 0.5 ? "Production buffer" : "Other";
        }
        const waste = surplus * WASTE_KG_PER_PORTION + served * (0.011 + rnd() * 0.006);
        actuals.push({
          id: `act_${record.id}`,
          date,
          locationId: loc.id,
          produced,
          served,
          surplus,
          wasteKg: +waste.toFixed(1),
          reason,
          note: null,
          recordedAt: stampAt(date, hm("13:40") + rnd() * 60),
        });
      }
      demand.push(record);
    }
    plan.totalApproved = plan.totalRecommended;
    plans.push(plan);
  });

  /* ---------- the upcoming service day: a mid-morning snapshot ---------- */
  const up = (id: string) => DEMO_LOCATIONS.find((l) => l.id === id)!;
  const upcoming: { id: string; state: "draft" | "confirmed" | "late" | "changed"; abs?: number; at?: string; expected?: number }[] = [
    { id: "harju", state: "draft" }, // the live demo school — confirmed during the demo
    { id: "koivu", state: "confirmed", abs: 31, at: "09:12" },
    { id: "satama", state: "draft" }, // tends to confirm late
    { id: "lumi", state: "changed", abs: 22, at: "08:40", expected: 334 },
    { id: "paiva", state: "confirmed", abs: 7, at: "07:58" },
    { id: "kielo", state: "confirmed", abs: 6, at: "09:31" },
    { id: "tuuli", state: "draft" }, // turns Missing if the clock passes 22:00
    { id: "mustikka", state: "confirmed", abs: 5, at: "10:24" },
  ];
  for (const u of upcoming) {
    const loc = up(u.id);
    const rec: DemandRecord = {
      id: `${serviceDate}_${loc.id}`,
      date: serviceDate,
      locationId: loc.id,
      expectedCount: u.expected ?? loc.normalCapacity,
      absenceCount: u.abs ?? 0,
      specialCounts: specials(loc, (u.expected ?? loc.normalCapacity) - (u.abs ?? 0), rnd),
      confirmed: u.state !== "draft",
      confirmedAt: u.at ? `${today}T${u.at}` : null,
      updatedAt: u.at ? `${today}T${u.at}` : null,
      updatedByRole: u.at ? "location" : null,
      changedAfterConfirm: u.state === "changed",
    };
    if (u.id === "harju") rec.specialCounts = { lactoseFree: 5, glutenFree: 2, vegetarian: 3, allergy: 2 };
    if (u.state === "draft") rec.specialCounts = u.id === "harju" ? rec.specialCounts : emptySpecial();
    if (u.state === "changed") {
      rec.updatedAt = `${today}T10:55`;
      changeLog.push({
        id: `cl_${rec.id}_c`, recordId: rec.id, date: serviceDate, locationId: loc.id, field: "confirm",
        previousValue: null, newValue: { expected: loc.normalCapacity, absences: 19 }, reason: null,
        timestamp: `${today}T08:40`, role: "location", afterDeadline: false,
      });
      changeLog.push({
        id: `cl_${rec.id}_x`, recordId: rec.id, date: serviceDate, locationId: loc.id, field: "count",
        previousValue: { expected: loc.normalCapacity, absences: 19 }, newValue: { expected: 334, absences: 22 },
        reason: "Grade 5 (26 pupils) on a museum trip to Kuopio", timestamp: `${today}T10:55`, role: "location", afterDeadline: false,
      });
    } else if (u.state !== "draft") {
      changeLog.push({
        id: `cl_${rec.id}_c`, recordId: rec.id, date: serviceDate, locationId: loc.id, field: "confirm",
        previousValue: null, newValue: { expected: rec.expectedCount, absences: rec.absenceCount }, reason: null,
        timestamp: rec.confirmedAt!, role: "location", afterDeadline: u.state === "late",
      });
    }
    demand.push(rec);
  }

  return {
    version: DB_VERSION,
    seededAt: toDateStr(realNow),
    locations,
    mealPlans,
    demand,
    changeLog,
    plans,
    actuals,
    settings,
  };
}
