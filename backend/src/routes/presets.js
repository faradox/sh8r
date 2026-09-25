import { z } from "zod";
import { listPresets, createPreset, deletePreset } from "../db/presets.js";
import { getShaderById } from "../db/shaders.js";
import { sanitizeParams } from "../params.js";
import { parseId } from "./ids.js";

const presetSchema = z.object({
  name: z.string().trim().max(120).optional(),
  shaderId: z.number().int().positive(),
  params: z.record(z.any()),
});

export default async function presetRoutes(fastify, options) {
  const { state } = options;

  fastify.get("/", async (request) => {
    return await listPresets(parseId(request.query.shader_id));
  });

  fastify.post("/", async (request, reply) => {
    const parsed = presetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid preset" });
    }
    const shader = await getShaderById(parsed.data.shaderId);
    if (!shader) {
      return reply.code(404).send({ error: "Shader not found" });
    }
    const { id } = await createPreset({
      name: parsed.data.name || null,
      shaderId: shader.id,
      params: sanitizeParams(shader.manifest, parsed.data.params),
    });
    state.broadcast({
      type: "presets:changed",
      payload: { shaderId: shader.id },
    });
    return reply.code(201).send({ id });
  });

  fastify.post("/:id/load", async (request, reply) => {
    const id = parseId(request.params.id);
    const applied = id && (await state.applyPreset(id));
    if (!applied) {
      return reply.code(404).send({ error: "Preset not found" });
    }
    return reply.code(200).send({ ok: true });
  });

  fastify.delete("/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    const deleted = id && (await deletePreset(id));
    if (!deleted) {
      return reply.code(404).send({ error: "Preset not found" });
    }
    state.broadcast({
      type: "presets:changed",
      payload: { shaderId: deleted.shader_id },
    });
    return reply.code(204).send();
  });
}
