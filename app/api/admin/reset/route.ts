import { handle, requireRole } from "@/lib/api";
import { resetDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, ["admin", "manager"]);
    const db = await resetDb();
    return { ok: true, locations: db.locations.length, days: new Set(db.actuals.map((a) => a.date)).size };
  });
}
