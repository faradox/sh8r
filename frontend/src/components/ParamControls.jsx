import React, { memo, useMemo } from "react";
import { defaultValue } from "../lib/params.js";

const AXES = ["x", "y", "z", "w"];

function stepFor(param) {
  if (Number.isFinite(param.step)) return param.step;
  return param.type === "int" ? 1 : 0.01;
}

function formatNumber(value, step) {
  const decimals = Math.min(4, (String(step).split(".")[1] || "").length);
  return Number(value).toFixed(decimals);
}

function Slider({ param, value, onChange }) {
  const step = stepFor(param);
  const min = param.min ?? 0;
  const max = param.max ?? 1;
  const number = Number.isFinite(Number(value)) ? Number(value) : min;
  return (
    <span className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={number}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>
        {formatNumber(number, step)}
        {param.unit ? ` ${param.unit}` : ""}
      </output>
    </span>
  );
}

function Control({ param, value, onChange }) {
  const label = param.label || param.name;
  const update = (next) => onChange({ [param.name]: next });
  const reset = () => update(defaultValue(param));
  const title = "Double-click the label to reset";

  if (param.type === "bool") {
    return (
      <label className="control control-inline">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => update(event.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  if (param.type === "enum") {
    return (
      <label className="control">
        <span className="label" title={title} onDoubleClick={reset}>
          {label}
        </span>
        <select
          value={Number(value) || 0}
          onChange={(event) => update(Number(event.target.value))}
        >
          {(param.values || []).map((entry, index) => (
            <option key={index} value={index}>
              {entry}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (param.type === "color") {
    return (
      <label className="control control-inline">
        <input
          type="color"
          value={typeof value === "string" ? value : "#ffffff"}
          onChange={(event) => update(event.target.value)}
        />
        <span className="label" title={title} onDoubleClick={reset}>
          {label}
        </span>
      </label>
    );
  }

  if (param.type === "vec2" || param.type === "vec3" || param.type === "vec4") {
    const size = Number(param.type.slice(3));
    const current = Array.isArray(value) ? value : defaultValue(param);
    return (
      <div className="control">
        <span className="label" title={title} onDoubleClick={reset}>
          {label}
        </span>
        {AXES.slice(0, size).map((axis, index) => (
          <span key={axis} className="axis">
            <span className="label">{axis}</span>
            <Slider
              param={param}
              value={current[index]}
              onChange={(next) => {
                const updated = [...current];
                updated[index] = next;
                update(updated);
              }}
            />
          </span>
        ))}
      </div>
    );
  }

  return (
    <label className="control">
      <span className="label" title={title} onDoubleClick={reset}>
        {label}
      </span>
      <Slider param={param} value={value} onChange={update} />
    </label>
  );
}

// Memoized per control so dragging one slider re-renders only that slider.
const MemoControl = memo(Control);

function ParamControls({ manifest, params, onChange }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const param of manifest?.params || []) {
      const name = param.group || "Controls";
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(param);
    }
    return Array.from(map.entries());
  }, [manifest]);

  if (!manifest) {
    return <p className="label">No shader loaded.</p>;
  }
  if (groups.length === 0) {
    return <p className="label">This shader has no parameters.</p>;
  }

  return (
    <div className="controls">
      {groups.map(([groupName, list]) => (
        <details key={groupName} className="group" open>
          <summary className="label">{groupName}</summary>
          <div className="controls">
            {list.map((param) => (
              <MemoControl
                key={param.name}
                param={param}
                value={params[param.name]}
                onChange={onChange}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default memo(ParamControls);
