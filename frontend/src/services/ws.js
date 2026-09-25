import { wallNow } from "../lib/clock.js";

function getDefaultWsUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost:3001/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

const WS_BASE = import.meta.env.VITE_WS_URL || getDefaultWsUrl();
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8000;
const PING_INTERVAL_MS = 10000;
const INITIAL_PINGS = 5;
// Without any server traffic for this long the connection is considered dead
// (e.g. after a network switch, where no close event ever arrives).
const SILENCE_LIMIT_MS = 25000;

// A read-only WebSocket (commands go over HTTP, see control.js) that
// reconnects with backoff and keeps pinging the server,
// which both measures clock offset and keeps idle proxies from closing it.
export function createConnection({ onMessage, onStatus, onPong }) {
  let socket = null;
  let attempts = 0;
  let retryTimer = null;
  let pingTimer = null;
  let lastTraffic = 0;
  let closed = false;

  function send(message) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  function schedulePings(remainingFast) {
    const delay = remainingFast > 0 ? 300 : PING_INTERVAL_MS;
    pingTimer = setTimeout(() => {
      if (wallNow() - lastTraffic > SILENCE_LIMIT_MS) {
        drop();
        return;
      }
      send({ type: "clock:ping", payload: { t0: wallNow() } });
      schedulePings(remainingFast - 1);
    }, delay);
  }

  function scheduleReconnect() {
    onStatus?.("disconnected");
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempts);
    attempts += 1;
    retryTimer = setTimeout(connect, delay * (0.75 + Math.random() * 0.5));
  }

  // Abandons the current socket without waiting for its close handshake.
  function drop() {
    clearTimeout(pingTimer);
    const dead = socket;
    socket = null;
    dead?.close();
    if (!closed) scheduleReconnect();
  }

  function connect() {
    onStatus?.(attempts === 0 ? "connecting" : "reconnecting");
    const current = new WebSocket(WS_BASE);
    socket = current;

    current.addEventListener("open", () => {
      if (socket !== current) return;
      attempts = 0;
      lastTraffic = wallNow();
      onStatus?.("connected");
      schedulePings(INITIAL_PINGS);
    });

    current.addEventListener("close", () => {
      if (socket !== current) return;
      drop();
    });

    current.addEventListener("message", (event) => {
      if (socket !== current) return;
      lastTraffic = wallNow();
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message?.type === "clock:pong") {
        onPong?.(message.payload?.t0, message.payload?.serverTime, wallNow());
        return;
      }
      onMessage?.(message);
    });
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(retryTimer);
      drop();
    },
  };
}
