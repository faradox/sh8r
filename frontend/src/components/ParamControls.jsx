import React, { useEffect, useMemo, useState } from "react";
import { getShader } from "../services/api.js";
import { useSh8r } from "../state/Sh8rContext.jsx";

function ensureArray(value, length) {
  if (Array.isArray(value) && value.length >= length) {
    return value.slice(0, length);
  }
  return Array.from({ length }, () => 0);
}

export default function ParamControls({ shaderId, params }) {
  const { send } = useSh8r();
  const [manifest, setManifest] = useState(null);

  useEffect(() => {
    if (!shaderId) {
      setManifest(null);
      return;
    }
    getShader(shaderId)
      .then((shader) => setManifest(shader.manifest))
      .catch(() => setManifest(null));
  }, [shaderId]);

  const groupedParams = useMemo(() => {
    const groups = new Map();
    const list = manifest?.params || [];
    for (const param of list) {
      const groupName = param.group || "Controls";
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName).push(param);
    }
    return Array.from(groups.entries());
  }, [manifest]);

  function updateParam(name, value) {
    send({ type: "state:patch", payload: { params: { [name]: value } } });
  }

  if (!manifest) {
    return <p className="label">No shader loaded.</p>;
  }

  return (
    <div className="controls">
      {groupedParams.map(([groupName, list]) => (
        <div key={groupName} className="card">
          <div className="label">{groupName}</div>
          <div className="controls">
            {list.map((param) => {
              const value = params[param.name];

              if (param.type === "bool") {
                return (
                  <label key={param.name} className="row">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) =>
                        updateParam(param.name, event.target.checked)
                      }
                    />
                    <span>{param.label || param.name}</span>
                  </label>
                );
              }

              if (param.type === "enum") {
                return (
                  <label key={param.name} className="control">
                    <span className="label">{param.label || param.name}</span>
                    <select
                      value={Number(value) || 0}
                      onChange={(event) =>
                        updateParam(param.name, Number(event.target.value))
                      }
                    >
                      {(param.values || []).map((entry, index) => (
                        <option key={entry} value={index}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (param.type === "color") {
                return (
                  <label key={param.name} className="control">
                    <span className="label">{param.label || param.name}</span>
                    <input
                      type="color"
                      value={typeof value === "string" ? value : "#ffffff"}
                      onChange={(event) =>
                        updateParam(param.name, event.target.value)
                      }
                    />
                  </label>
                );
              }

              if (param.type === "vec2" || param.type === "vec3" || param.type === "vec4") {
                const length = Number(param.type.slice(3));
                const current = ensureArray(value, length);
                return (
                  <div key={param.name} className="control">
                    <span className="label">{param.label || param.name}</span>
                    {current.map((entry, index) => (
                      <input
                        key={`${param.name}-${index}`}
                        type="range"
                        min={param.min ?? 0}
                        max={param.max ?? 1}
                        step={param.step ?? 0.01}
                        value={entry}
                        onChange={(event) => {
                          const next = [...current];
                          next[index] = Number(event.target.value);
                          updateParam(param.name, next);
                        }}
                      />
                    ))}
                  </div>
                );
              }

              return (
                <label key={param.name} className="control">
                  <span className="label">{param.label || param.name}</span>
                  <input
                    type="range"
                    min={param.min ?? 0}
                    max={param.max ?? 1}
                    step={param.step ?? 0.01}
                    value={Number(value) || 0}
                    onChange={(event) =>
                      updateParam(param.name, Number(event.target.value))
                    }
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
