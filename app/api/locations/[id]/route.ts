import { ApiError, handle } from "@/lib/api";
import { analyticsRows, buildLocationView, changeHistory, explainRow, getNow, getServiceDate } from "@/lib/calculations";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const db = await readDb();
    const loc = db.locations.find((l) => l.id === id);
    if (!loc) throw new ApiError("Unknown location.", 404);
    const now = getNow(db.settings);
    const serviceDate = getServiceDate(now);
    const view = buildLocationView(db, loc, serviceDate, now);
    return {
      now,
      serviceDate,
      view,
      explanation: explainRow(view, db.settings.bufferPercent),
      history: analyticsRows(db, 30, loc.id),
      log: changeHistory(db, loc.id).slice(0, 25),
      settings: db.settings,
    };
  });
}
