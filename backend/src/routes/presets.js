import { z } from "zod";
import { listPresets, createPreset } from "../db/presets.js";

const presetSchema = z.object({
  name: z.string().optional(),
  shaderId: z.number(),
  params: z.record(z.any()),
});

export default async function presetRoutes(fastify, options) {
  const { state } = options;

  fastify.get("/", async (request) => {
    const shaderId = request.query.shader_id
      ? Number(request.query.shader_id)
      : null;
    return await listPresets(shaderId);
  });

  fastify.post("/", async (request, reply) => {
    const parsed = presetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.format() });
    }
    const { id } = await createPreset({
      name: parsed.data.name,
      shaderId: parsed.data.shaderId,
      params: parsed.data.params,
    });
    return reply.code(201).send({ id });
  });

  fastify.post("/:id/load", async (request, reply) => {
    const presetId = Number(request.params.id);
    const applied = await state.applyPreset(presetId);
    if (!applied) {
      return reply.code(404).send({ error: "Preset not found" });
    }
    return reply.code(200).send({ ok: true });
  });
}
