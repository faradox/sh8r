import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { closePool, initSchema } from "./db/client.js";
import shaderRoutes from "./routes/shaders.js";
import presetRoutes from "./routes/presets.js";
import controlRoutes from "./routes/control.js";
import { createState } from "./ws/state.js";
import { handleSocketMessage, startHeartbeat, trackAlive } from "./ws/handler.js";

const LOG_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);

function logLevel() {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (level === "warning") return "warn";
  return LOG_LEVELS.has(level) ? level : "info";
}

const fastify = Fastify({
  logger: { level: logLevel() },
});

await fastify.register(cors, {
  origin: true,
});
await fastify.register(websocket, {
  options: { maxPayload: 4 * 1024 },
});

const state = createState();
await initSchema();
await state.initFromDatabase();

fastify.get("/health", async () => ({ status: "ok" }));

fastify.register(
  async (instance) => {
    instance.register(shaderRoutes, { prefix: "/shaders", state });
    instance.register(presetRoutes, { prefix: "/presets", state });
    instance.register(controlRoutes, { prefix: "/control", state });
  },
  { prefix: "/api" }
);

fastify.get("/ws", { websocket: true }, (socket) => {
  trackAlive(socket);
  state.addClient(socket);
  socket.on("message", (raw) => handleSocketMessage(state, socket, raw));
});

const stopHeartbeat = startHeartbeat(state.clients);

async function shutdown(signal) {
  fastify.log.info({ signal }, "Shutting down");
  stopHeartbeat();
  state.closeAll();
  try {
    await fastify.close();
    await closePool();
  } finally {
    process.exit(0);
  }
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

const port = Number(process.env.PORT) || 3001;

try {
  await fastify.listen({ port, host: "0.0.0.0" });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
