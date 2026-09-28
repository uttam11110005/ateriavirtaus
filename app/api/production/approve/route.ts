import { ApiError, handle, int, requireRole, text } from "@/lib/api";
import { allocate, buildSnapshot } from "@/lib/calculations";
import { mutateDb } from "@/lib/store";
import type { ProductionPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/production/approve { total, reason, approvedBy }
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, ["kitchen", "admin"]);
    const body = await req.json().catch(() => ({}));
    return mutateDb((db) => {
      const snap = buildSnapshot(db);
      const rec = snap.totals.recommended;
      const total = int(body.total, "total", { min: 0, max: Math.max(50, Math.round(rec * 1.5)) });
      const reason = text(body.reason);
      if (total !== rec && !reason) {
        throw new ApiError(`You changed the quantity from ${rec}. Add a reason so the decision is traceable.`, 422, "reason");
      }
      const plan: ProductionPlan = {
        date: snap.serviceDate,
        totalRecommended: rec,
        totalApproved: total,
        adjustmentReason: total === rec ? null : reason,
        approvedBy: text(body.approvedBy, 60) ?? "Kitchen user",
        approvedAt: snap.now,
        allocations: allocate(snap.rows, total),
        forecasts: Object.fromEntries(snap.rows.map((r) => [r.location.id, r.forecast])),
        statuses: Object.fromEntries(snap.rows.map((r) => [r.location.id, r.status])),
      };
      db.plans = db.plans.filter((p) => p.date !== plan.date);
      db.plans.push(plan);
      return plan;
    });
  });
}
