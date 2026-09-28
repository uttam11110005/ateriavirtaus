import { handle } from "@/lib/api";
import { buildSnapshot } from "@/lib/calculations";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/production/recommendation → consolidated demand + explainable recommendation
export async function GET() {
  return handle(async () => {
    const db = await readDb();
    const snap = buildSnapshot(db);
    const changesSinceApproval = snap.plan
      ? db.changeLog.filter((c) => c.date === snap.serviceDate && c.timestamp > snap.plan!.approvedAt)
      : [];
    return { ...snap, changesSinceApproval, locations: db.locations };
  });
}
