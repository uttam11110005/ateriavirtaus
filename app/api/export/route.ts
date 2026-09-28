import { analyticsRows } from "@/lib/calculations";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/export?days=30 → CSV of forecast vs actual (synthetic demo data only)
export async function GET(req: Request) {
  const db = await readDb();
  const url = new URL(req.url);
  const days = Math.min(60, Math.max(5, Number(url.searchParams.get("days")) || 30));
  const locationId = url.searchParams.get("locationId");
  const rows = analyticsRows(db, days, locationId);
  const name = (id: string) => db.locations.find((l) => l.id === id)?.name ?? id;
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["date", "location", "confirmation_status", "forecast", "produced", "served", "variance", "surplus", "waste_kg", "reason"];
  const lines = rows.map((r) =>
    [r.date, name(r.locationId), r.status, r.forecast, r.produced, r.served, r.forecast - r.served, r.surplus, r.wasteKg, r.reason]
      .map(esc)
      .join(","),
  );
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ateriavirtaus-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
