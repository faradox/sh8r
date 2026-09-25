import { z } from "zod";
import { createControlHandler } from "../ws/handler.js";

const commandSchema = z.object({
  type: z.string(),
  payload: z.record(z.any()).optional(),
  // Id from the sender's state:init, used to skip echoing its own changes.
  clientId: z.string().max(64).optional(),
});

export default async function controlRoutes(fastify, options) {
  const { state } = options;
  const control = createControlHandler(state);

  fastify.post("/", { bodyLimit: 64 * 1024 }, async (request, reply) => {
    const parsed = commandSchema.safeParse(request.body);
    if (!parsed.success || !control.has(parsed.data.type)) {
      return reply.code(400).send({ error: "Unknown command" });
    }
    const { type, payload, clientId } = parsed.data;
    const ok = await control.run(type, payload, state.findClient(clientId));
    return reply.code(ok ? 200 : 404).send({ ok: Boolean(ok) });
  });
}
