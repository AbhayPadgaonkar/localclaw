// db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 1. Read Connection String
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing in .env");
}

// 2. Create Postgres Client
// 'prepare: false' is recommended for serverless/edge compatibility if you deploy later
const client = postgres(connectionString, { prepare: false });

// 3. Initialize Drizzle & Export
export const db = drizzle(client, { schema });