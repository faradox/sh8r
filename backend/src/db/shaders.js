import { query } from "./client.js";

export async function listShaders() {
  const result = await query(
    "SELECT id, created_at, meta FROM shaders ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function getShaderById(id) {
  const result = await query(
    "SELECT id, created_at, manifest, code, meta FROM shaders WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function createShader({ manifest, code, meta }) {
  const result = await query(
    "INSERT INTO shaders (manifest, code, meta) VALUES ($1, $2, $3) RETURNING id",
    [manifest, code, meta]
  );
  return result.rows[0];
}

export async function deleteShader(id) {
  const result = await query("DELETE FROM shaders WHERE id = $1", [id]);
  return result.rowCount > 0;
}
