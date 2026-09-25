import React, { useCallback, useEffect, useState } from "react";
import { createPreset, deletePreset, listPresets } from "../services/api.js";
import { useSh8r, useSh8rMessages } from "../state/Sh8rContext.jsx";

export default function PresetBar({ shaderId, params }) {
  const { control } = useSh8r();
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(null);

  const refresh = useCallback(() => {
    if (!shaderId) {
      setPresets([]);
      return;
    }
    listPresets(shaderId)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [shaderId]);

  useEffect(refresh, [refresh]);

  useSh8rMessages((message) => {
    if (
      message.type === "state:init" ||
      (message.type === "presets:changed" &&
        message.payload?.shaderId === shaderId)
    ) {
      refresh();
    }
  });

  async function handleSave(event) {
    event.preventDefault();
    if (!shaderId) return;
    try {
      await createPreset({ name: name.trim() || undefined, shaderId, params });
      setName("");
      setStatus(null);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleDelete(preset) {
    const label = preset.name || `Preset ${preset.id}`;
    if (!window.confirm(`Delete preset "${label}"?`)) return;
    try {
      await deletePreset(preset.id);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="presets">
      <form className="row" onSubmit={handleSave}>
        <span className="label">Presets</span>
        <input
          placeholder="Preset name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={!shaderId}>
          Save
        </button>
        {status && <span className="status error">{status}</span>}
      </form>
      {presets.length > 0 && (
        <div className="chips">
          {presets.map((preset) => (
            <span key={preset.id} className="chip">
              <button
                type="button"
                onClick={() => control("preset:load", { presetId: preset.id })}
              >
                {preset.name || `Preset ${preset.id}`}
              </button>
              <button
                type="button"
                className="chip-delete"
                aria-label={`Delete preset ${preset.name || preset.id}`}
                onClick={() => handleDelete(preset)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
