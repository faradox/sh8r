import React, { useCallback, useEffect, useState } from "react";
import { deleteShader, listShaders } from "../services/api.js";
import { useSh8r, useSh8rMessages } from "../state/Sh8rContext.jsx";
import { useShader } from "../hooks/useShader.js";
import { readSetting, writeSetting } from "../lib/storage.js";
import { defaultValue } from "../lib/params.js";
import ShaderRenderer from "../components/ShaderRenderer.jsx";
import ParamControls from "../components/ParamControls.jsx";
import BpmControl from "../components/BpmControl.jsx";
import PresetBar from "../components/PresetBar.jsx";
import StatusDot from "../components/StatusDot.jsx";

const PREVIEW_KEY = "sh8r.vj.preview";

export default function VJView() {
  const { shaderId, params, wsStatus, control, controlError, updateParams } =
    useSh8r();
  const { shader } = useShader(shaderId);
  const manifest = shader?.manifest ?? null;
  // The preview keeps showing the previous shader until the next one loads.
  const { shader: previewShader } = useShader(shaderId, { keepPrevious: true });
  const [shaders, setShaders] = useState([]);
  const [status, setStatus] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(() => readSetting(PREVIEW_KEY, true));

  const refreshShaders = useCallback(() => {
    listShaders()
      .then(setShaders)
      .catch((error) => setStatus(error.message));
  }, []);

  useEffect(refreshShaders, [refreshShaders]);

  useSh8rMessages((message) => {
    // state:init arrives after every reconnect; the list may have changed.
    if (message.type === "shaders:changed" || message.type === "state:init") {
      refreshShaders();
    }
  });

  function togglePreview() {
    setPreview((current) => {
      writeSetting(PREVIEW_KEY, !current);
      return !current;
    });
  }

  function handleShaderChange(event) {
    const id = Number(event.target.value);
    if (Number.isInteger(id) && id > 0) {
      control("shader:set", { shaderId: id });
    }
  }

  function resetAll() {
    const defaults = {};
    for (const param of manifest?.params || []) {
      defaults[param.name] = defaultValue(param);
    }
    updateParams(defaults);
  }

  async function handleShaderDelete() {
    if (!shaderId || deleting) return;
    const title = shader?.meta?.title || `Shader ${shaderId}`;
    if (!window.confirm(`Delete "${title}" and its presets? This cannot be undone.`)) {
      return;
    }
    setStatus(null);
    setDeleting(true);
    try {
      await deleteShader(shaderId);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="vj">
      <div className="card toolbar">
        <div className="row wrap">
          <StatusDot status={wsStatus} />
          <select
            className="shader-select"
            value={shaderId || ""}
            onChange={handleShaderChange}
            aria-label="Live shader"
          >
            <option value="" disabled>
              Select shader
            </option>
            {shaders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.meta?.title || `Shader ${item.id}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleShaderDelete}
            disabled={!shaderId || deleting}
          >
            Delete
          </button>
          <BpmControl />
          {status && <span className="status error">{status}</span>}
          {controlError && <span className="status error">{controlError}</span>}
        </div>
        <PresetBar shaderId={shaderId} params={params} />
      </div>

      <div className="vj-main">
        <div className="card">
          <div className="row spread">
            <h2>{shader?.meta?.title || "No shader selected"}</h2>
            <button type="button" onClick={togglePreview}>
              {preview ? "Hide preview" : "Show preview"}
            </button>
          </div>
          {preview && (
            <div className="canvas-wrap">
              <ShaderRenderer
                manifest={previewShader?.manifest ?? null}
                params={params}
                showErrors
                maxPixels={960 * 540}
              />
            </div>
          )}
        </div>
        <div className="card">
          <div className="row spread">
            <h3>Controls</h3>
            <button type="button" onClick={resetAll} disabled={!manifest?.params?.length}>
              Reset all
            </button>
          </div>
          <ParamControls manifest={manifest} params={params} onChange={updateParams} />
        </div>
      </div>
    </section>
  );
}
