import { ApiError, handle, int, num, requireRole, text } from "@/lib/api";
import { getNow, varianceNeedsReason } from "@/lib/calculations";
import { mutateDb, readDb } from "@/lib/store";
import { VARIANCE_REASONS, type VarianceReason } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/actuals?date=YYYY-MM-DD → planned vs recorded per location
export async function GET(req: Request) {
  return handle(async () => {
    const db = await readDb();
    const url = new URL(req.url);
    const now = getNow(db.settings);
    const approved = [...db.plans].sort((a, b) => (a.date < b.date ? 1 : -1));
    const pending = approved
      .filter((p) => db.locations.some((l) => !db.actuals.find((a) => a.date === p.date && a.locationId === l.id)))
      .map((p) => p.date);
    const date = url.searchParams.get("date") ?? pending[0] ?? approved[0]?.date ?? null;
    const plan = db.plans.find((p) => p.date === date) ?? null;
    return {
      now,
      date,
      plan,
      pendingDates: pending,
      recentDates: approved.slice(0, 12).map((p) => p.date),
      meal: db.mealPlans.find((m) => m.date === date) ?? null,
      varianceThreshold: db.settings.varianceThreshold,
      rows: db.locations.map((l) => ({
        location: l,
        planned: plan?.allocations[l.id] ?? 0,
        forecast: plan?.forecasts[l.id] ?? 0,
        status: plan?.statuses[l.id] ?? null,
        actual: db.actuals.find((a) => a.date === date && a.locationId === l.id) ?? null,
      })),
    };
  });
}

// POST /api/actuals { date, rows: [{ locationId, produced, served, surplus, wasteKg, reason, note }] }
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, ["kitchen", "admin"]);
    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.rows) || body.rows.length === 0) throw new ApiError("No rows to save.");
    return mutateDb((db) => {
      const plan = db.plans.find((p) => p.date === body.date);
      if (!plan) throw new ApiError("Approve a production plan for this date before recording actuals.", 422);
      const now = getNow(db.settings);
      const saved = [];
      for (const r of body.rows) {
        const loc = db.locations.find((l) => l.id === r.locationId);
        if (!loc) throw new ApiError("Unknown location.", 404);
        const f = (k: string) => `${loc.id}.${k}`;
        const produced = int(r.produced, f("produced"), { max: 5000 });
        const served = int(r.served, f("served"), { max: 5000 });
        if (served > produced) throw new ApiError("Served cannot exceed produced.", 422, f("served"));
        const surplus = int(r.surplus ?? produced - served, f("surplus"), { max: produced - served });
        const wasteKg = num(r.wasteKg, f("wasteKg"), { max: 1000 });
        const reason = r.reason && VARIANCE_REASONS.includes(r.reason) ? (r.reason as VarianceReason) : null;
        const forecast = plan.forecasts[loc.id] ?? produced;
        if (varianceNeedsReason(forecast, served, db.settings.varianceThreshold) && !reason) {
          throw new ApiError(`Served differs from the forecast (${forecast}). Pick a reason.`, 422, f("reason"));
        }
        const actual = {
          id: `act_${body.date}_${loc.id}`,
          date: body.date as string,
          locationId: loc.id,
          produced,
          served,
          surplus,
          wasteKg,
          reason,
          note: text(r.note),
          recordedAt: now,
        };
        db.actuals = db.actuals.filter((a) => !(a.date === actual.date && a.locationId === loc.id));
        db.actuals.push(actual);
        saved.push(actual);
      }
      return { saved: saved.length };
    });
  });
}
