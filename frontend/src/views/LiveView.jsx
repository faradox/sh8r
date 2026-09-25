import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSh8r } from "../state/Sh8rContext.jsx";
import { useShader } from "../hooks/useShader.js";
import ShaderRenderer from "../components/ShaderRenderer.jsx";

const CURSOR_HIDE_MS = 2000;

// URL options: ?debug shows stats, ?scale=0.5 fixes the render scale
// (disables adaptive resolution), ?dpr=2 renders above CSS resolution,
// ?maxpx=8294400 raises the pixel cap (default 1920x1080).
function useLiveOptions() {
  const { search } = useLocation();
  return useMemo(() => {
    const query = new URLSearchParams(search);
    const number = (key, min, max) => {
      const value = Number(query.get(key));
      return query.has(key) && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : null;
    };
    return {
      debug: query.has("debug"),
      scale: number("scale", 0.1, 2),
      maxDpr: number("dpr", 0.25, 4) ?? 1,
      maxPixels: number("maxpx", 1e4, 3.3e7) ?? 1920 * 1080,
    };
  }, [search]);
}

function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return undefined;
    let lock = null;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((next) => {
          lock = next;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);
}

function useIdleCursor(ref) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const node = ref.current;
    let timer = setTimeout(() => setIdle(true), CURSOR_HIDE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), CURSOR_HIDE_MS);
    };
    node.addEventListener("pointermove", wake);
    return () => {
      clearTimeout(timer);
      node.removeEventListener("pointermove", wake);
    };
  }, [ref]);
  return idle;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

export default function LiveView() {
  const { shaderId, params } = useSh8r();
  const { shader } = useShader(shaderId, { keepPrevious: true });
  const options = useLiveOptions();
  const rootRef = useRef(null);
  const idle = useIdleCursor(rootRef);
  useWakeLock();

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "f" || event.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`live-root${idle ? " idle" : ""}`}
      onDoubleClick={toggleFullscreen}
      title="Double-click or press F for fullscreen"
    >
      <ShaderRenderer
        key={JSON.stringify(options)}
        manifest={shader?.manifest ?? null}
        params={params}
        debug={options.debug}
        showErrors={options.debug}
        scale={options.scale}
        maxDpr={options.maxDpr}
        maxPixels={options.maxPixels}
      />
    </div>
  );
}
