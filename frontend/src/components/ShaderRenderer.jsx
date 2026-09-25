import React, { useEffect, useRef, useState } from "react";
import { ShaderEngine } from "../gl/ShaderEngine.js";
import { useSh8r } from "../state/Sh8rContext.jsx";

// Renders a manifest with the given params. Engine options are read once
// at mount; remount (change `key`) to change them.
export default function ShaderRenderer({
  manifest,
  params,
  paused = false,
  debug = false,
  showErrors = false,
  scale = null,
  maxDpr = 1,
  maxPixels = 1920 * 1080,
  onStatus,
}) {
  const { clock } = useSh8r();
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const [stats, setStats] = useState(null);
  const [compile, setCompile] = useState({ error: null, compileMs: null });

  useEffect(() => {
    let engine;
    try {
      engine = new ShaderEngine(containerRef.current, {
        scale,
        maxDpr,
        maxPixels,
        onStats: (next) => {
          if (debug) setStats(next);
          onStatusRef.current?.({ stats: next });
        },
      });
    } catch (error) {
      setCompile({ error: error.message, compileMs: null });
      onStatusRef.current?.({ unsupported: error.message });
      return undefined;
    }
    engine.setClock(clock.read);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // Engine options are intentionally fixed for the engine's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setShader(manifest || null).then((result) => {
      if (result.superseded) return;
      const next = {
        error: result.ok ? null : result.error,
        compileMs: result.compileMs ?? null,
      };
      setCompile(next);
      onStatusRef.current?.({ compile: next });
    });
  }, [manifest]);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  const showOverlay = debug || (showErrors && compile.error);

  return (
    <div className="renderer" ref={containerRef}>
      {showOverlay && (
        <div className={`renderer-overlay${compile.error ? " error" : ""}`}>
          {debug && stats && (
            <div>
              {stats.fps} fps · {stats.width}x{stats.height} ·{" "}
              {Math.round(stats.scale * 100)}%
            </div>
          )}
          {debug && compile.compileMs !== null && (
            <div>compile {compile.compileMs} ms</div>
          )}
          {compile.error && <pre>{compile.error}</pre>}
        </div>
      )}
    </div>
  );
}
