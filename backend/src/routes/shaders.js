import { z } from "zod";
import {
  listShaders,
  getShaderById,
  createShader,
  deleteShader,
} from "../db/shaders.js";
import { PARAM_TYPES, isValidIdentifier } from "../params.js";
import { parseId } from "./ids.js";

// Names the fragment wrapper declares itself; params must not shadow them.
const RESERVED_NAMES = new Set([
  "time",
  "resolution",
  "bpm",
  "beat",
  "bar",
  "shader",
  "main",
]);

const paramSchema = z
  .object({
    name: z.string(),
    type: z.enum(PARAM_TYPES),
    default: z.any().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    label: z.string().optional(),
    values: z.array(z.union([z.string(), z.number()])).optional(),
    group: z.string().optional(),
    ui: z.string().optional(),
    unit: z.string().optional(),
  })
  .passthrough();

const manifestSchema = z.object({
  meta: z.object({
    title: z.string().trim().min(1),
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

function formatZodError(error) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
    .join("; ");
}

export function validateManifest(manifest) {
  const parsed = manifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const params = parsed.data.params || [];
  const names = new Set();
  for (const param of params) {
    if (!isValidIdentifier(param.name)) {
      return { ok: false, error: "Invalid param name: " + param.name };
    }
    if (RESERVED_NAMES.has(param.name) || param.name.startsWith("gl_")) {
      return { ok: false, error: "Reserved param name: " + param.name };
    }
    if (names.has(param.name)) {
      return { ok: false, error: "Duplicate param name: " + param.name };
    }
    if (param.type === "enum" && !param.values?.length) {
      return { ok: false, error: "Enum param needs values: " + param.name };
    }
    names.add(param.name);
  }
  return { ok: true, value: { ...parsed.data, params } };
}

function normalizeManifestInput(body) {
  if (typeof body?.manifest === "string") {
    return JSON.parse(body.manifest);
  }
  return body?.manifest ?? null;
}

function rawGlslManifest(body) {
  return {
    meta: { title: body.title?.trim() || "Raw GLSL" },
    params: [],
    shader: { language: "glsl", entry: "shader", code: body.glsl },
    raw: true,
  };
}

export default async function shaderRoutes(fastify, options) {
  const { state } = options;

  fastify.get("/", async () => {
    return await listShaders();
  });

  fastify.get("/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    const shader = id && (await getShaderById(id));
    if (!shader) {
      return reply.code(404).send({ error: "Shader not found" });
    }
    return shader;
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    let manifest;

    if (typeof body.glsl === "string" && body.glsl.trim() && !body.manifest) {
      manifest = rawGlslManifest(body);
    } else {
      let input;
      try {
        input = normalizeManifestInput(body);
      } catch {
        return reply.code(400).send({ error: "Invalid JSON manifest" });
      }
      if (!input) {
        return reply.code(400).send({ error: "Manifest is required" });
      }
      const validation = validateManifest(input);
      if (!validation.ok) {
        return reply.code(400).send({ error: validation.error });
      }
      manifest = validation.value;
    }

    const { id } = await createShader({
      manifest,
      code: manifest.shader.code,
      meta: manifest.meta,
    });

    state.broadcast({ type: "shaders:changed", payload: {} });
    if (!state.state.shaderId || body.goLive === true) {
      await state.setShader(id);
    }

    return reply.code(201).send({ id });
  });

  fastify.delete("/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    const deleted = id && (await deleteShader(id));
    if (!deleted) {
      return reply.code(404).send({ error: "Shader not found" });
    }
    await state.handleShaderDeleted(id);
    state.broadcast({ type: "shaders:changed", payload: {} });
    return reply.code(204).send();
  });
}
