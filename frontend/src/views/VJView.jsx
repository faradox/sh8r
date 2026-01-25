import React, { useEffect, useMemo, useState } from "react";
import {
  createPreset,
  deleteShader,
  listPresets,
  listShaders,
  loadPreset,
} from "../services/api.js";
import { useSh8r } from "../state/Sh8rContext.jsx";
import ShaderRenderer from "../components/ShaderRenderer.jsx";
import ParamControls from "../components/ParamControls.jsx";

export default function VJView() {
  const { shaderId, params, bpm, wsStatus, send } = useSh8r();
  const [shaders, setShaders] = useState([]);
  const [presets, setPresets] = useState([]);
  const [activeShader, setActiveShader] = useState(null);
  const [presetName, setPresetName] = useState("");
  const [status, setStatus] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function refreshShaders() {
    try {
      const data = await listShaders();
      setShaders(data);
    } catch (error) {
      setShaders([]);
    }
  }

  useEffect(() => {
    refreshShaders();
  }, []);

  useEffect(() => {
    if (!shaderId) return;
    const shader = shaders.find((item) => item.id === shaderId);
    if (shader) {
      setActiveShader(shader);
    }
    listPresets(shaderId).then(setPresets).catch(() => setPresets([]));
  }, [shaderId, shaders]);

  function handleShaderChange(event) {
    const id = Number(event.target.value);
    if (!Number.isFinite(id)) return;
    send({ type: "shader:set", payload: { shaderId: id } });
  }

  function handleBpmChange(event) {
    const next = Number(event.target.value);
    send({ type: "bpm:set", payload: { bpm: next } });
  }

  async function handlePresetSave() {
    if (!shaderId) return;
    setStatus(null);
    try {
      await createPreset({
        name: presetName || undefined,
        shaderId,
        params,
      });
      setPresetName("");
      const data = await listPresets(shaderId);
      setPresets(data);
      setStatus("Preset saved.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleShaderDelete() {
    if (!shaderId || deleting) return;
    setStatus(null);
    setDeleting(true);
    try {
      await deleteShader(shaderId);
      await refreshShaders();
      setPresets([]);
      setStatus("Shader deleted.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setDeleting(false);
    }
  }

  const shaderTitle = useMemo(() => {
    if (!activeShader?.meta?.title) return "No shader selected";
    return activeShader.meta.title;
  }, [activeShader]);

  return (
    <section className="grid">
      <div className="card grid">
        <div className="row">
          <span className="label">WS</span>
          <span>{wsStatus}</span>
          <span className="label">Shader</span>
          <select value={shaderId || ""} onChange={handleShaderChange}>
            <option value="" disabled>
              Select shader
            </option>
            {shaders.map((shader) => (
              <option key={shader.id} value={shader.id}>
                {shader.meta?.title || `Shader ${shader.id}`}
              </option>
            ))}
          </select>
          <button type="button" onClick={refreshShaders}>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleShaderDelete}
            disabled={!shaderId || deleting}
          >
            Delete
          </button>
          <span className="label">BPM</span>
          <input
            type="number"
            min="20"
            max="240"
            step="1"
            value={bpm}
            onChange={handleBpmChange}
          />
        </div>
        <div className="row">
          <span className="label">Presets</span>
          <select
            onChange={(event) => loadPreset(Number(event.target.value))}
          >
            <option value="">Select preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name || `Preset ${preset.id}`}
              </option>
            ))}
          </select>
          <input
            placeholder="Preset name"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button type="button" onClick={handlePresetSave}>
            Save preset
          </button>
          {status && <span>{status}</span>}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="card">
          <h2>{shaderTitle}</h2>
          <div className="canvas-wrap">
            <ShaderRenderer shaderId={shaderId} params={params} bpm={bpm} />
          </div>
        </div>
        <div className="card">
          <h3>Controls</h3>
          <ParamControls shaderId={shaderId} params={params} />
        </div>
      </div>
    </section>
  );
}
