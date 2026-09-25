import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createConnection } from "../services/ws.js";
import { createControlQueue } from "../services/control.js";
import { sendControl } from "../services/api.js";
import { beatPhase, createClockSync } from "../lib/clock.js";

const Sh8rContext = createContext(null);

export function Sh8rProvider({ children }) {
  const listenersRef = useRef(new Set());
  const clientIdRef = useRef(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [shaderId, setShaderId] = useState(null);
  const [params, setParams] = useState({});
  const [bpm, setBpm] = useState(120);
  // Result of the last control command: null, "ok" or an error message.
  const [controlError, setControlError] = useState(null);
  const [controlQueue] = useState(() =>
    createControlQueue({
      send: sendControl,
      getClientId: () => clientIdRef.current,
      onSuccess: () => setControlError(null),
      onError: (error) => setControlError(error.message),
    })
  );
  const [clockSync] = useState(createClockSync);
  // Read every frame by renderers, so kept outside React state.
  const tempoRef = useRef({ bpm: 120, beatEpoch: 0 });

  useEffect(() => {
    function applyTempo(payload) {
      if (Number.isFinite(payload.bpm)) {
        tempoRef.current.bpm = payload.bpm;
        setBpm(payload.bpm);
      }
      if (Number.isFinite(payload.beatEpoch)) {
        tempoRef.current.beatEpoch = payload.beatEpoch;
      }
    }

    function handleMessage(message) {
      const payload = message.payload || {};
      if (message.type === "state:init") {
        clientIdRef.current = payload.clientId ?? null;
        setShaderId(payload.shaderId ?? null);
        setParams(payload.params || {});
        applyTempo(payload);
      } else if (message.type === "state:patch") {
        // A patch naming the shader carries its complete param set.
        if (payload.shaderId !== undefined) {
          controlQueue.dropPendingParams();
          setShaderId(payload.shaderId);
          setParams(payload.params || {});
        } else if (payload.params) {
          setParams((prev) => ({ ...prev, ...payload.params }));
        }
        applyTempo(payload);
      }
      for (const listener of listenersRef.current) {
        listener(message);
      }
    }

    const connection = createConnection({
      onMessage: handleMessage,
      onStatus: (status) => {
        if (status === "connecting" || status === "reconnecting") {
          clockSync.reset();
        }
        setWsStatus(status);
      },
      onPong: clockSync.addSample,
    });
    return () => {
      connection.close();
    };
  }, [clockSync, controlQueue]);

  // VJ commands go over HTTP (authenticated at the proxy); the WebSocket is
  // read-only so live viewers need no credentials.
  const control = useCallback(
    (type, payload = {}) => controlQueue.push(type, payload),
    [controlQueue]
  );

  // Applies locally right away, then sends to the server (which does not
  // echo the change back to this client).
  const updateParams = useCallback(
    (patch) => {
      setParams((prev) => ({ ...prev, ...patch }));
      controlQueue.push("state:patch", { params: patch });
    },
    [controlQueue]
  );

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const clock = useMemo(
    () => ({
      sync: clockSync,
      serverNow: clockSync.serverNow,
      // Called by renderers once per frame.
      read() {
        const { bpm: currentBpm, beatEpoch } = tempoRef.current;
        return {
          bpm: currentBpm,
          ...beatPhase(clockSync.serverNow(), currentBpm, beatEpoch),
        };
      },
    }),
    [clockSync]
  );

  const value = useMemo(
    () => ({
      wsStatus,
      shaderId,
      params,
      bpm,
      clock,
      control,
      controlError,
      updateParams,
      subscribe,
    }),
    [
      wsStatus,
      shaderId,
      params,
      bpm,
      clock,
      control,
      controlError,
      updateParams,
      subscribe,
    ]
  );

  return (
    <Sh8rContext.Provider value={value}>{children}</Sh8rContext.Provider>
  );
}

export function useSh8r() {
  const context = useContext(Sh8rContext);
  if (!context) {
    throw new Error("useSh8r must be used within Sh8rProvider");
  }
  return context;
}

// Calls `listener` for every server message (except clock pongs).
export function useSh8rMessages(listener) {
  const { subscribe } = useSh8r();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => subscribe((message) => listenerRef.current(message)), [subscribe]);
}
