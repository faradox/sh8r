import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createSocket } from "../services/ws.js";

const Sh8rContext = createContext(null);

export function Sh8rProvider({ children }) {
  const socketRef = useRef(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [shaderId, setShaderId] = useState(null);
  const [params, setParams] = useState({});
  const [bpm, setBpm] = useState(120);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    const socket = createSocket((message) => {
      setLastMessage(message);
      if (message.type === "state:init") {
        setShaderId(message.payload.shaderId);
        setParams(message.payload.params || {});
        setBpm(message.payload.bpm || 120);
      }
      if (message.type === "state:patch") {
        if (message.payload.shaderId !== undefined) {
          setShaderId(message.payload.shaderId);
        }
        if (message.payload.params) {
          setParams((prev) => ({ ...prev, ...message.payload.params }));
        }
        if (message.payload.bpm !== undefined) {
          setBpm(message.payload.bpm);
        }
      }
    }, setWsStatus);

    socketRef.current = socket;
    return () => {
      socket.socket.close();
    };
  }, []);

  const value = useMemo(
    () => ({
      wsStatus,
      shaderId,
      params,
      bpm,
      lastMessage,
      send: (message) => {
        if (socketRef.current?.send) {
          socketRef.current.send(message);
        }
      },
      setParams,
      setShaderId,
      setBpm,
    }),
    [wsStatus, shaderId, params, bpm, lastMessage]
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
