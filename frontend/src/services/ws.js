function getDefaultWsUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost:3001/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

const WS_BASE = import.meta.env.VITE_WS_URL || getDefaultWsUrl();

export function createSocket(onMessage, onStatus) {
  const socket = new WebSocket(WS_BASE);

  socket.addEventListener("open", () => {
    onStatus?.("connected");
  });

  socket.addEventListener("close", () => {
    onStatus?.("disconnected");
  });

  socket.addEventListener("error", () => {
    onStatus?.("disconnected");
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      onMessage?.(message);
    } catch (error) {
      onMessage?.({ type: "error", payload: { error } });
    }
  });

  return {
    socket,
    send(message) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
  };
}
