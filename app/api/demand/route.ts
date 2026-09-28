import { ApiError, handle, int, requireRole, text } from "@/lib/api";
import {
  buildLocationView,
  buildSnapshot,
  getNow,
  getServiceDate,
  isMaterialChange,
  specialTotal,
    changeHistory,
  defaultRecord,
  planningDates,
} from "@/lib/calculations";
import type { Database, Location } from "@/lib/types";
import { mutateDb, readDb } from "@/lib/store";
import { SPECIAL_DIETS, type ChangeLog, type SpecialCounts } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Confirmed count vs. meals actually eaten, for the location's own feedback. */
function countHistory(db: Database, loc: Location, limit = 10) {
  const dates = [...new Set(db.actuals.filter((a) => a.locationId === loc.id).map((a) => a.date))].sort().slice(-limit);
  return dates.map((date) => {
    const actual = db.actuals.find((a) => a.date === date && a.locationId === loc.id)!;
    const rec = db.demand.find((r) => r.date === date && r.locationId === loc.id);
    const status = db.plans.find((p) => p.date === date)?.statuses[loc.id] ?? "confirmed";
    return {
      date,
      status,
      confirmed: rec && rec.confirmed ? rec.expectedCount - rec.absenceCount : null,
      ate: actual.served,
    };
  });
}

function resolveDate(requested: string | null | undefined, serviceDate: string) {
  const allowed = planningDates(serviceDate);
  if (!requested) return { date: serviceDate, allowed };
  if (!allowed.includes(requested)) {
    throw new ApiError("Counts can be given for the next 7 service days only.", 422, "date");
  }
  return { date: requested, allowed };
}

// GET /api/demand?locationId=harju&date=YYYY-MM-DD → one location's view for a planning day
// GET /api/demand                                   → all locations, next service day
export async function GET(req: Request) {
  return handle(async () => {
    const db = await readDb();
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const now = getNow(db.settings);
    const serviceDate = getServiceDate(now);
    if (!locationId) return buildSnapshot(db).rows;

    const loc = db.locations.find((l) => l.id === locationId);
    if (!loc) throw new ApiError("Unknown location.", 404);
    const { date, allowed } = resolveDate(url.searchParams.get("date"), serviceDate);
    const view = buildLocationView(db, loc, date, now);
    return {
      now,
      serviceDate,
      date,
      days: allowed.map((d) => {
        const v = buildLocationView(db, loc, d, now);
        return { date: d, status: v.status, deadline: v.deadline, diners: v.record.confirmed ? v.netDiners : null };
      }),
      meal: db.mealPlans.find((m) => m.date === date) ?? null,
      view,
      plan: db.plans.find((p) => p.date === date) ?? null,
      history: countHistory(db, loc),
      log: changeHistory(db, loc.id).filter((c) => c.date === date),
      settings: db.settings,
    };
  });
}

// POST /api/demand  { locationId, expectedCount, absenceCount, specialCounts, reason, action: "save" | "confirm" }
export async function POST(req: Request) {
  return handle(async () => {
    const role = requireRole(req, ["location", "kitchen", "admin"]);
    const body = await req.json().catch(() => ({}));

    return mutateDb((db) => {
      const loc = db.locations.find((l) => l.id === body.locationId);
      if (!loc) throw new ApiError("Unknown location.", 404);
      const now = getNow(db.settings);
      const { date } = resolveDate(body.date, getServiceDate(now));

      const expectedCount = int(body.expectedCount, "expectedCount", { max: Math.round(loc.normalCapacity * 1.5) });
      const absenceCount = int(body.absenceCount, "absenceCount");
      if (absenceCount > expectedCount) {
        throw new ApiError("Pupils on leave cannot exceed the expected diners.", 422, "absenceCount");
      }
      const specialCounts = {} as SpecialCounts;
      for (const k of SPECIAL_DIETS) specialCounts[k] = int(body.specialCounts?.[k] ?? 0, `special.${k}`);
      if (specialTotal(specialCounts) > expectedCount - absenceCount) {
        throw new ApiError("Special meals cannot exceed the number of diners.", 422, "special");
      }

      let record = db.demand.find((r) => r.date === date && r.locationId === loc.id);
      if (!record) {
        record = defaultRecord(date, loc);
        db.demand.push(record);
      }
      const view = buildLocationView(db, loc, date, now);
      const afterDeadline = now > view.deadline;
      const prev = { expected: record.expectedCount, absences: record.absenceCount };
      const next = { expected: expectedCount, absences: absenceCount };
      const reason = text(body.reason);
      const countsChanged = prev.expected !== next.expected || prev.absences !== next.absences;
      const specialsChanged = SPECIAL_DIETS.some((k) => record!.specialCounts[k] !== specialCounts[k]);

      if (record.confirmed) {
        if (!countsChanged && !specialsChanged) throw new ApiError("Nothing changed.", 422);
        if (countsChanged && isMaterialChange(prev, next, db.settings.materialChangeThreshold) && !reason) {
          throw new ApiError(
            `This changes the count by more than ${db.settings.materialChangeThreshold} meals. Add a short reason for the kitchen.`,
            422,
            "reason",
          );
        }
      } else if (body.action !== "confirm" && body.action !== "save") {
        throw new ApiError("Unknown action.");
      }

      const entry: ChangeLog | null =
        record.confirmed || body.action === "confirm"
          ? {
              id: `cl_${record.id}_${Date.now()}`,
              recordId: record.id,
              date,
              locationId: loc.id,
              field: record.confirmed ? "count" : "confirm",
              previousValue: record.confirmed ? prev : null,
              newValue: next,
              reason,
              timestamp: now,
              role,
              afterDeadline,
            }
          : null;

      if (record.confirmed) {
        record.changedAfterConfirm = true;
      } else if (body.action === "confirm") {
        record.confirmed = true;
        record.confirmedAt = now;
      }
      record.expectedCount = expectedCount;
      record.absenceCount = absenceCount;
      record.specialCounts = specialCounts;
      record.updatedAt = now;
      record.updatedByRole = role;
      if (entry) db.changeLog.push(entry);

      return buildLocationView(db, loc, date, now);
    });
  });
}
