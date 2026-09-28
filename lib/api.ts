import { NextResponse } from "next/server";
import type { Role } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public field?: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message, field: e.field }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

const ROLES: Role[] = ["location", "kitchen", "manager", "admin"];

/** Demo role switch (PRD §9.1) — writes are still checked server-side against the role. */
export function requireRole(req: Request, allowed: Role[]): Role {
  const role = req.headers.get("x-demo-role") as Role | null;
  if (!role || !ROLES.includes(role)) throw new ApiError("Select a demo role first.", 401);
  if (!allowed.includes(role)) throw new ApiError(`The ${role} role cannot perform this action.`, 403);
  return role;
}

export function int(value: unknown, field: string, { min = 0, max = 100000 } = {}): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ApiError("Enter a whole number.", 422, field);
  }
  if (n < min) throw new ApiError(min === 0 ? "Counts cannot be negative." : `Must be at least ${min}.`, 422, field);
  if (n > max) throw new ApiError(`Must be at most ${max}.`, 422, field);
  return n;
}

export function num(value: unknown, field: string, { min = 0, max = 100000 } = {}): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new ApiError("Enter a number.", 422, field);
  if (n < min) throw new ApiError("Cannot be negative.", 422, field);
  if (n > max) throw new ApiError(`Must be at most ${max}.`, 422, field);
  return Math.round(n * 10) / 10;
}

export function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t.length ? t : null;
}
