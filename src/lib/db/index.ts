/**
 * Drizzle client for Neon Postgres (postgres.js driver).
 * Server-only — never import into client components.
 *
 * The client is initialized LAZILY (on first query) so that merely importing
 * this module never throws. This matters during `next build`, which evaluates
 * route/page modules to collect data — at that point env vars may be present
 * but we must not require a live connection just to import.
 */

import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _db?: DB;
};

function getDb(): DB {
  if (globalForDb._db) return globalForDb._db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client =
    globalForDb._pgClient ??
    postgres(connectionString, { max: 10, prepare: false });

  const instance = drizzle(client, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb._pgClient = client;
    globalForDb._db = instance;
  }
  return instance;
}

/**
 * Lazy proxy: property access initializes the real client on first use.
 * `import { db }` is side-effect free; `db.select(...)` connects.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as DB;

export { schema };
