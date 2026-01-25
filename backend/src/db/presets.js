import { query } from "./client.js";

export async function listPresets(shaderId) {
  if (shaderId) {
    const result = await query(
      "SELECT id, created_at, name, shader_id, params FROM presets WHERE shader_id = $1 ORDER BY created_at DESC",
      [shaderId]
    );
    return result.rows;
  }
  const result = await query(
    "SELECT id, created_at, name, shader_id, params FROM presets ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function getPresetById(id) {
  const result = await query(
    "SELECT id, created_at, name, shader_id, params FROM presets WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function createPreset({ name, shaderId, params }) {
  const result = await query(
    "INSERT INTO presets (name, shader_id, params) VALUES ($1, $2, $3) RETURNING id",
    [name, shaderId, params]
  );
  return result.rows[0];
}
