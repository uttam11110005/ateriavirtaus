import { ApiError, handle, int, requireRole } from "@/lib/api";
import { getNow, getServiceDate } from "@/lib/calculations";
import { mutateDb, readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const db = await readDb();
    const now = getNow(db.settings);
    return { settings: db.settings, now, serviceDate: getServiceDate(now), locations: db.locations };
  });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: Request) {
  return handle(async () => {
    const role = requireRole(req, ["location", "kitchen", "manager", "admin"]);
    const b = await req.json().catch(() => ({}));
    // The demo clock is a presentation control any role may move; real configuration is manager/admin only.
    const configKeys = Object.keys(b).filter((k) => k !== "clockMode" && k !== "simulatedNow");
    if (configKeys.length && role !== "manager" && role !== "admin") {
      throw new ApiError("Only a manager or demo admin can change these settings.", 403);
    }
    return mutateDb((db) => {
      const s = db.settings;
      if (b.deadlines) {
        for (const k of ["school", "daycare"] as const) {
          if (b.deadlines[k] !== undefined) {
            if (!TIME.test(b.deadlines[k])) throw new ApiError("Use HH:MM.", 422, `deadlines.${k}`);
            s.deadlines[k] = b.deadlines[k];
          }
        }
      }
      if (b.bufferPercent !== undefined) s.bufferPercent = int(b.bufferPercent, "bufferPercent", { max: 15 });
      if (b.materialChangeThreshold !== undefined)
        s.materialChangeThreshold = int(b.materialChangeThreshold, "materialChangeThreshold", { min: 1, max: 200 });
      if (b.varianceThreshold !== undefined)
        s.varianceThreshold = int(b.varianceThreshold, "varianceThreshold", { min: 1, max: 50 });
      if (b.useHistoricalAdjustment !== undefined) s.useHistoricalAdjustment = !!b.useHistoricalAdjustment;
      if (b.clockMode !== undefined) {
        if (b.clockMode !== "real" && b.clockMode !== "simulated") throw new ApiError("Unknown clock mode.");
        s.clockMode = b.clockMode;
      }
      if (b.simulatedNow !== undefined) {
        if (!STAMP.test(b.simulatedNow)) throw new ApiError("Invalid time.", 422, "simulatedNow");
        s.simulatedNow = b.simulatedNow;
      }
      const now = getNow(s);
      return { settings: s, now, serviceDate: getServiceDate(now) };
    });
  });
}
