import { useEffect, useState } from "react";
import { getShader } from "../services/api.js";

// Resolves a shader id to { shader, error }; shaders are cached by the API
// layer so several components can ask for the same id cheaply.
// With `keepPrevious`, the last loaded shader is returned while the next one
// loads, so renderers do not blank the screen between two shaders.
export function useShader(shaderId, { keepPrevious = false } = {}) {
  const [result, setResult] = useState({ shader: null, error: null });

  useEffect(() => {
    if (!shaderId) {
      setResult({ shader: null, error: null });
      return undefined;
    }
    let cancelled = false;
    getShader(shaderId)
      .then((shader) => {
        if (!cancelled) setResult({ shader, error: null });
      })
      .catch((error) => {
        if (!cancelled) setResult({ shader: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [shaderId]);

  // Avoid showing the previous shader's data for a new id.
  if (result.shader && result.shader.id !== shaderId && !(keepPrevious && shaderId)) {
    return { shader: null, error: null };
  }
  return result;
}
