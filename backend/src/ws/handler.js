const HEARTBEAT_MS = 30000;
const MAX_MESSAGE_BYTES = 4 * 1024;

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

// Commands that change the show. They arrive over POST /api/control, which
// the reverse proxy puts behind authentication; `origin` is the sender's
// socket (if known) so its own param changes are not echoed back to it.
export function createControlHandler(state) {
  const handlers = {
    "state:patch": (payload, origin) => {
      state.applyParamPatch(payload?.params, origin);
      return true;
    },
    "shader:set": async (payload) => {
      const shaderId = positiveInt(payload?.shaderId);
      return shaderId ? state.setShader(shaderId) : false;
    },
    "preset:load": async (payload) => {
      const presetId = positiveInt(payload?.presetId);
      return presetId ? state.applyPreset(presetId) : false;
    },
    "bpm:set": (payload) => state.setBpm(payload?.bpm, payload?.beatEpoch),
    "beat:sync": () => {
      state.syncBeat();
      return true;
    },
  };

  return {
    has: (type) => Object.prototype.hasOwnProperty.call(handlers, type),
    run: (type, payload, origin) => handlers[type](payload, origin),
  };
}

// The WebSocket is read-only: clients receive state and may only ping for
// clock sync, so it can stay open to unauthenticated live viewers.
export function handleSocketMessage(state, socket, raw) {
  if (raw.length > MAX_MESSAGE_BYTES) return;
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (message?.type === "clock:ping") {
    state.send(socket, {
      type: "clock:pong",
      payload: { t0: message.payload?.t0, serverTime: Date.now() },
    });
  }
}

// Terminates sockets that stop answering pings so dead clients do not pile
// up in the broadcast set.
export function startHeartbeat(clients) {
  const timer = setInterval(() => {
    for (const socket of clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);
  timer.unref();
  return () => clearInterval(timer);
}

export function trackAlive(socket) {
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
}
