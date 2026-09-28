import { handle } from "@/lib/api";
import { buildAnalytics } from "@/lib/calculations";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/analytics?days=30&locationId=harju
export async function GET(req: Request) {
  return handle(async () => {
    const db = await readDb();
    const url = new URL(req.url);
    const days = Math.min(60, Math.max(5, Number(url.searchParams.get("days")) || 30));
    const locationId = url.searchParams.get("locationId");
    return { ...buildAnalytics(db, days, locationId), locations: db.locations, settings: db.settings };
  });
}
