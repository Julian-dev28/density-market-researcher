import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

export function getDb(connectionString: string): Db {
  if (!_db) {
    const sql = postgres(connectionString);
    _db = drizzle(sql, { schema });
  }
  return _db;
}
