import React, { useState } from "react";
import { useSh8r, useSh8rMessages } from "../state/Sh8rContext.jsx";
import { useShader } from "../hooks/useShader.js";
import ShaderRenderer from "../components/ShaderRenderer.jsx";
import StatusDot from "../components/StatusDot.jsx";

const MAX_MESSAGES = 20;

export default function DebugView() {
  const { shaderId, params, bpm, wsStatus, clock } = useSh8r();
  const { shader, error } = useShader(shaderId);
  const [messages, setMessages] = useState([]);
  const [renderer, setRenderer] = useState({});

  useSh8rMessages((message) => {
    setMessages((prev) =>
      [{ at: new Date().toLocaleTimeString(), message }, ...prev].slice(0, MAX_MESSAGES)
    );
  });

  const uniforms = [
    "time",
    "resolution",
    "bpm",
    "beat",
    "bar",
    ...(shader?.manifest?.params || []).map((param) => `${param.name}: ${param.type}`),
  ];

  return (
    <section className="debug">
      <div className="card debug-panel">
        <h2>Debug</h2>
        <StatusDot status={wsStatus} />
        <div>Clock offset: {Math.round(clock.sync.offset)} ms (rtt {clock.sync.rtt ?? "?"} ms)</div>
        <div>Shader: {shader?.meta?.title ?? "none"} (id {shaderId ?? "none"})</div>
        {error && <div className="status error">{error}</div>}
        <div>BPM: {bpm}</div>
        <div>Renderer: {JSON.stringify(renderer)}</div>
        <div>Uniforms: {uniforms.join(", ")}</div>
        <div>Params: {JSON.stringify(params, null, 2)}</div>
        <h3>Recent messages</h3>
        {messages.map((entry, index) => (
          <div key={index}>
            {entry.at} {JSON.stringify(entry.message)}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="canvas-wrap">
          <ShaderRenderer
            manifest={shader?.manifest ?? null}
            params={params}
            debug
            showErrors
            onStatus={(update) => setRenderer((prev) => ({ ...prev, ...update }))}
          />
        </div>
      </div>
    </section>
  );
}
