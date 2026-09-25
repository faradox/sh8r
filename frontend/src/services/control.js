// Sends VJ commands one request at a time, in order. Consecutive param
// patches waiting in the queue are merged, so a dragged slider adapts its
// send rate to the round trip time instead of piling up requests that could
// arrive out of order.
export function createControlQueue({ send, getClientId, onError, onSuccess }) {
  const queue = [];
  let busy = false;

  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length > 0) {
      const command = queue.shift();
      try {
        await send({ ...command, clientId: getClientId() || undefined });
        onSuccess?.();
      } catch (error) {
        onError?.(error, command);
      }
    }
    busy = false;
  }

  return {
    push(type, payload) {
      const last = queue[queue.length - 1];
      if (type === "state:patch" && last?.type === "state:patch") {
        last.payload = { params: { ...last.payload.params, ...payload.params } };
      } else {
        queue.push({ type, payload });
      }
      pump();
    },
    // Pending param changes belong to the shader that was live when made.
    dropPendingParams() {
      for (let i = queue.length - 1; i >= 0; i -= 1) {
        if (queue[i].type === "state:patch") queue.splice(i, 1);
      }
    },
  };
}
