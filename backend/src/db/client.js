import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/sh8r";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf-8");
  await query(schemaSql);
}

export async function closePool() {
  await pool.end();
}
