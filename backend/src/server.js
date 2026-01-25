import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { initSchema } from "./db/client.js";
import shaderRoutes from "./routes/shaders.js";
import presetRoutes from "./routes/presets.js";
import { createState } from "./ws/state.js";

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});
await fastify.register(websocket);

const state = createState();
await initSchema();
await state.initFromDatabase();

fastify.get("/health", async () => ({ status: "ok" }));

fastify.register(
  async (instance) => {
    instance.register(shaderRoutes, { prefix: "/shaders", state });
    instance.register(presetRoutes, { prefix: "/presets", state });
  },
  { prefix: "/api" }
);

fastify.get("/ws", { websocket: true }, (connection) => {
  const socket = connection?.socket ?? connection;
  state.addClient(socket);

  socket.on("message", async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    if (!message?.type) {
      return;
    }

    if (message.type === "state:patch") {
      state.applyParamPatch(message.payload?.params || {});
    }

    if (message.type === "shader:set") {
      const shaderId = Number(message.payload?.shaderId);
      if (Number.isFinite(shaderId)) {
        await state.setShader(shaderId);
      }
    }

    if (message.type === "preset:load") {
      const presetId = Number(message.payload?.presetId);
      if (Number.isFinite(presetId)) {
        await state.applyPreset(presetId);
      }
    }

    if (message.type === "bpm:set") {
      state.setBpm(message.payload?.bpm);
    }
  });
});

const port = Number(process.env.PORT) || 3001;

fastify.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
