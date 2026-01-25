import React from "react";
import { useSh8r } from "../state/Sh8rContext.jsx";
import ShaderRenderer from "../components/ShaderRenderer.jsx";

export default function LiveView() {
  const { shaderId, params, bpm } = useSh8r();

  return (
    <div className="live-root">
      <div className="canvas-wrap live-canvas">
        <ShaderRenderer shaderId={shaderId} params={params} bpm={bpm} />
      </div>
    </div>
  );
}
