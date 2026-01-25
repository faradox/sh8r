import { z } from "zod";
import {
  listShaders,
  getShaderById,
  createShader,
  deleteShader,
} from "../db/shaders.js";

const paramSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    default: z.any().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    label: z.string().optional(),
    values: z.array(z.any()).optional(),
    group: z.string().optional(),
    ui: z.string().optional(),
    unit: z.string().optional(),
  })
  .passthrough();

const manifestSchema = z.object({
  meta: z.object({
    title: z.string().min(1),
    author: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  params: z.array(paramSchema).optional(),
  shader: z.object({
    language: z.string().optional(),
    entry: z.literal("shader"),
    code: z.string().min(1),
  }),
});

function isValidIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function validateManifest(manifest) {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.format() };
  }
  const params = parsed.data.params || [];
  const names = new Set();
  for (const param of params) {
    if (!isValidIdentifier(param.name)) {
      return { ok: false, error: "Invalid param name: " + param.name };
    }
    if (names.has(param.name)) {
      return { ok: false, error: "Duplicate param name: " + param.name };
    }
    names.add(param.name);
  }
  return { ok: true, value: parsed.data };
}

function normalizeManifestInput(body) {
  if (body?.manifest && typeof body.manifest === "string") {
    return JSON.parse(body.manifest);
  }
  return body?.manifest ?? null;
}

export default async function shaderRoutes(fastify, options) {
  const { state } = options;

  fastify.get("/", async () => {
    return await listShaders();
  });

  fastify.get("/:id", async (request, reply) => {
    const shader = await getShaderById(request.params.id);
    if (!shader) {
      return reply.code(404).send({ error: "Shader not found" });
    }
    return shader;
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};

    if (body.glsl && !body.manifest) {
      const manifest = {
        meta: { title: body.title || "Raw GLSL" },
        params: [],
        shader: {
          language: "glsl",
          entry: "shader",
          code: body.glsl,
        },
        raw: true,
      };
      const { id } = await createShader({
        manifest,
        code: body.glsl,
        meta: manifest.meta,
      });
      if (!state.state.shaderId) {
        await state.setShader(id);
      }
      return reply.code(201).send({ id });
    }

    let manifest;
    try {
      manifest = normalizeManifestInput(body);
    } catch (error) {
      return reply.code(400).send({ error: "Invalid JSON manifest" });
    }

    if (!manifest) {
      return reply.code(400).send({ error: "Manifest is required" });
    }

    const validation = validateManifest(manifest);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }

    const { id } = await createShader({
      manifest: validation.value,
      code: validation.value.shader.code,
      meta: validation.value.meta,
    });

    if (!state.state.shaderId) {
      await state.setShader(id);
    }

    return reply.code(201).send({ id });
  });

  fastify.delete("/:id", async (request, reply) => {
    const shaderId = request.params.id;
    const deleted = await deleteShader(shaderId);
    if (!deleted) {
      return reply.code(404).send({ error: "Shader not found" });
    }
    if (state.state.shaderId === Number(shaderId)) {
      state.state.shaderId = null;
      state.state.shaderManifest = null;
      state.state.params = {};
    }
    return reply.code(204).send();
  });
}
