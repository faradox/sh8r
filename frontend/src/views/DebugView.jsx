import React, { useState } from "react";
import { useSh8r } from "../state/Sh8rContext.jsx";
import ShaderRenderer from "../components/ShaderRenderer.jsx";

export default function DebugView() {
  const { shaderId, params, bpm, wsStatus, lastMessage } = useSh8r();
  const [rendererInfo, setRendererInfo] = useState(null);

  return (
    <section className="grid">
      <div className="card">
        <h2>Debug</h2>
        <div className="debug-panel">
          <div>WS: {wsStatus}</div>
          <div>Shader ID: {shaderId ?? "none"}</div>
          <div>BPM: {bpm}</div>
          <div>Renderer: {JSON.stringify(rendererInfo, null, 2)}</div>
          <div>Params: {JSON.stringify(params, null, 2)}</div>
          <div>Last message: {JSON.stringify(lastMessage, null, 2)}</div>
        </div>
      </div>
      <div className="card">
        <div className="canvas-wrap" style={{ minHeight: "50vh" }}>
          <ShaderRenderer
            shaderId={shaderId}
            params={params}
            bpm={bpm}
            debug
            onDebug={setRendererInfo}
          />
        </div>
      </div>
    </section>
  );
}
