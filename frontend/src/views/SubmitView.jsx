import React, { useMemo, useState } from "react";
import { submitShader } from "../services/api.js";

export default function SubmitView() {
  const [manifestText, setManifestText] = useState("");
  const [glslText, setGlslText] = useState("");
  const [status, setStatus] = useState(null);

  const canSubmit = useMemo(() => {
    return manifestText.trim().length > 0 || glslText.trim().length > 0;
  }, [manifestText, glslText]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus(null);

    try {
      if (manifestText.trim()) {
        JSON.parse(manifestText.trim());
        await submitShader({ manifest: manifestText.trim() });
      } else {
        await submitShader({ glsl: glslText.trim() });
      }
      setManifestText("");
      setGlslText("");
      setStatus("Shader submitted.");
    } catch (error) {
      setStatus(error.message || "Submit failed");
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setManifestText(text);
  }

  return (
    <section className="grid">
      <div className="card">
        <h2>Submit shader</h2>
        <p className="label">
          Upload a manifest JSON or paste it below. Raw GLSL works too.
        </p>
        <div className="row">
          <input type="file" accept=".json" onChange={handleFileUpload} />
        </div>
      </div>
      <form className="card grid" onSubmit={handleSubmit}>
        <label className="label">Manifest JSON</label>
        <textarea
          rows={10}
          value={manifestText}
          onChange={(event) => setManifestText(event.target.value)}
          placeholder="Paste shader manifest JSON"
        />
        <label className="label">Raw GLSL (optional)</label>
        <textarea
          rows={8}
          value={glslText}
          onChange={(event) => setGlslText(event.target.value)}
          placeholder="Paste raw GLSL if no manifest"
        />
        <div className="label">
          If manifest is present, raw GLSL is ignored.
        </div>
        <div className="row">
          <button type="submit" disabled={!canSubmit}>
            Submit
          </button>
          {status && <span>{status}</span>}
        </div>
      </form>
    </section>
  );
}
