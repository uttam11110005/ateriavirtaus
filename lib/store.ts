import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createSeed, DB_VERSION } from "./demo-data";
import type { Database } from "./types";

// Prototype persistence: a single JSON file. The shape mirrors the relational
// model in the PRD (§8.1) so it can move to Postgres/Supabase without redesign.
// On Vercel the project folder is read-only, so the demo store lives in /tmp there:
// it survives between requests on a warm instance and reseeds itself when it is gone.
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "ateriavirtaus-db.json")
  : path.join(process.cwd(), "data", "db.json");

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Database;
    if (db.version === DB_VERSION) return db;
  } catch {
    /* missing or unreadable — reseed below */
  }
  const db = createSeed();
  await save(db);
  return db;
}

async function save(db: Database) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, DB_PATH);
}

export function readDb(): Promise<Database> {
  return (queue = queue.then(load, load)) as Promise<Database>;
}

/** Serialised read-modify-write so concurrent requests never clobber each other. */
export function mutateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function resetDb(): Promise<Database> {
  return mutateDb((db) => {
    const fresh = createSeed();
    Object.assign(db, fresh);
    return db;
  });
}
