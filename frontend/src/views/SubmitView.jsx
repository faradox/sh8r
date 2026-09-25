import React, { useEffect, useMemo, useState } from "react";
import { submitShader } from "../services/api.js";
import { deriveDefaultParams } from "../lib/params.js";
import ShaderRenderer from "../components/ShaderRenderer.jsx";
import ParamControls from "../components/ParamControls.jsx";

const PARSE_DELAY_MS = 400;

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Turns the form input into a manifest for previewing. Only catches what the
// preview needs; the server performs the full validation on submit.
function parseInput(manifestText, glslText) {
  if (manifestText.trim()) {
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch (error) {
      return { error: `Invalid JSON: ${error.message}` };
    }
    if (typeof manifest?.shader?.code !== "string" || !manifest.shader.code) {
      return { error: "Manifest needs shader.code" };
    }
    if (!manifest?.meta?.title) {
      return { error: "Manifest needs meta.title" };
    }
    return { manifest };
  }
  if (glslText.trim()) {
    return {
      manifest: {
        meta: { title: "Raw GLSL" },
        params: [],
        shader: { entry: "shader", code: glslText },
      },
    };
  }
  return {};
}

export default function SubmitView() {
  const [manifestText, setManifestText] = useState("");
  const [glslText, setGlslText] = useState("");
  const [title, setTitle] = useState("");
  const [goLive, setGoLive] = useState(false);
  const [status, setStatus] = useState(null);
  // "checking" until the preview reports a compile result for the current
  // input; "unsupported" when this device cannot compile (no WebGL).
  const [compile, setCompile] = useState({ state: "checking", error: null });
  const [submitting, setSubmitting] = useState(false);
  const [previewParams, setPreviewParams] = useState({});

  const debouncedManifest = useDebounced(manifestText, PARSE_DELAY_MS);
  const debouncedGlsl = useDebounced(glslText, PARSE_DELAY_MS);
  const parsed = useMemo(
    () => parseInput(debouncedManifest, debouncedGlsl),
    [debouncedManifest, debouncedGlsl]
  );

  useEffect(() => {
    setCompile((prev) =>
      prev.state === "unsupported" ? prev : { state: "checking", error: null }
    );
    setPreviewParams(deriveDefaultParams(parsed.manifest));
  }, [parsed.manifest]);

  const pending =
    manifestText !== debouncedManifest || glslText !== debouncedGlsl;
  const compileOk = compile.state === "ok" || compile.state === "unsupported";
  const canSubmit =
    parsed.manifest && !parsed.error && compileOk && !pending && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus(null);
    setSubmitting(true);
    try {
      const payload = manifestText.trim()
        ? { manifest: manifestText.trim(), goLive }
        : { glsl: glslText.trim(), title: title.trim() || undefined, goLive };
      await submitShader(payload);
      setManifestText("");
      setGlslText("");
      setTitle("");
      setStatus({ ok: true, text: goLive ? "Shader submitted and live." : "Shader submitted." });
    } catch (error) {
      setStatus({ ok: false, text: error.message || "Submit failed" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setManifestText(await file.text());
    event.target.value = "";
  }

  const problem = parsed.error || compile.error;

  return (
    <section className="submit">
      <form className="card grid" onSubmit={handleSubmit}>
        <h2>Submit shader</h2>
        <p className="label">
          Upload or paste a manifest JSON (see docs/shader-manifests.md), or
          paste raw GLSL defining <code>vec3 shader(vec2 uv, float time)</code>.
        </p>
        <input type="file" accept=".json,application/json" onChange={handleFileUpload} />
        <label className="label" htmlFor="manifest-input">
          Manifest JSON
        </label>
        <textarea
          id="manifest-input"
          rows={12}
          spellCheck={false}
          value={manifestText}
          onChange={(event) => setManifestText(event.target.value)}
          placeholder="Paste shader manifest JSON"
        />
        <label className="label" htmlFor="glsl-input">
          Raw GLSL (used only when the manifest is empty)
        </label>
        <textarea
          id="glsl-input"
          rows={8}
          spellCheck={false}
          value={glslText}
          disabled={Boolean(manifestText.trim())}
          onChange={(event) => setGlslText(event.target.value)}
          placeholder="vec3 shader(vec2 uv, float time) { return vec3(uv, 0.5); }"
        />
        {!manifestText.trim() && glslText.trim() && (
          <input
            placeholder="Title for raw GLSL"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
        <label className="row">
          <input
            type="checkbox"
            checked={goLive}
            onChange={(event) => setGoLive(event.target.checked)}
          />
          <span>Switch the live view to it</span>
        </label>
        <div className="row wrap">
          <button type="submit" disabled={!canSubmit}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          {parsed.manifest && (pending || compile.state === "checking") && (
            <span className="label">Checking...</span>
          )}
          {status && (
            <span className={`status${status.ok ? "" : " error"}`}>{status.text}</span>
          )}
        </div>
        {problem && <pre className="status error">{problem}</pre>}
      </form>

      <div className="card grid">
        <h3>Preview</h3>
        <div className="canvas-wrap">
          {parsed.manifest ? (
            <ShaderRenderer
              manifest={parsed.manifest}
              params={previewParams}
              maxPixels={960 * 540}
              debug
              onStatus={(update) => {
                if (update.unsupported) {
                  setCompile({ state: "unsupported", error: null });
                } else if (update.compile) {
                  const { error } = update.compile;
                  setCompile({ state: error ? "error" : "ok", error });
                }
              }}
            />
          ) : (
            <p className="label placeholder">Nothing to preview yet.</p>
          )}
        </div>
        {parsed.manifest && (
          <ParamControls
            manifest={parsed.manifest}
            params={previewParams}
            onChange={(patch) => setPreviewParams((prev) => ({ ...prev, ...patch }))}
          />
        )}
      </div>
    </section>
  );
}
