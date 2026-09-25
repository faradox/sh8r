import { query } from "./client.js";

// Shaders are immutable once stored, so full rows can be cached until deleted.
const shaderCache = new Map();

export async function listShaders() {
  const result = await query(
    "SELECT id, created_at, meta FROM shaders ORDER BY created_at DESC, id DESC"
  );
  return result.rows;
}

export async function getShaderById(id) {
  if (shaderCache.has(id)) {
    return shaderCache.get(id);
  }
  const result = await query(
    "SELECT id, created_at, manifest, code, meta FROM shaders WHERE id = $1",
    [id]
  );
  const shader = result.rows[0] || null;
  if (shader) {
    shaderCache.set(id, shader);
  }
  return shader;
}

export async function createShader({ manifest, code, meta }) {
  const result = await query(
    "INSERT INTO shaders (manifest, code, meta) VALUES ($1, $2, $3) RETURNING id",
    [manifest, code, meta]
  );
  return result.rows[0];
}

export async function deleteShader(id) {
  shaderCache.delete(id);
  const result = await query("DELETE FROM shaders WHERE id = $1", [id]);
  return result.rowCount > 0;
}
