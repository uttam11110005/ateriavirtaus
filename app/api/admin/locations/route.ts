import { ApiError, handle, int, requireRole, text } from "@/lib/api";
import { mutateDb } from "@/lib/store";
import type { Location } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/admin/locations { id?, name, type, normalCapacity, contact } — create or update a fictional location
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, ["admin"]);
    const b = await req.json().catch(() => ({}));
    return mutateDb((db) => {
      const name = text(b.name, 60);
      if (!name) throw new ApiError("Give the location a name.", 422, "name");
      if (b.type !== "school" && b.type !== "daycare") throw new ApiError("Pick a type.", 422, "type");
      const normalCapacity = int(b.normalCapacity, "normalCapacity", { min: 1, max: 2000 });
      const contact = text(b.contact, 60) ?? "Demo contact";
      const existing = db.locations.find((l) => l.id === b.id);
      if (existing) {
        Object.assign(existing, { name, type: b.type, normalCapacity, contact });
        return existing;
      }
      const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "loc";
      let id = base;
      for (let i = 2; db.locations.some((l) => l.id === id); i++) id = `${base}-${i}`;
      const loc: Location = { id, name, type: b.type, normalCapacity, contact };
      db.locations.push(loc);
      return loc;
    });
  });
}
