import { defaultValue } from "../lib/params.js";

const VECTOR_SIZES = { vec2: 2, vec3: 3, vec4: 4, color: 3 };

function hexToRgb(value) {
  let hex = typeof value === "string" ? value.trim().replace(/^#/, "") : "";
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function toVector(source, size) {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    const number = Number(source?.[i]);
    out[i] = Number.isFinite(number) ? number : 0;
  }
  return out;
}

// Converts a param value into what the matching gl.uniform* call expects:
// a number for scalars, a Float32Array of the right length for vectors.
export function uniformValue(param, value) {
  const fallback = () => uniformValue(param, defaultValue(param));
  if (value === null || value === undefined || value === "") {
    return fallback();
  }
  switch (param.type) {
    case "int":
    case "enum": {
      const number = Math.trunc(Number(value));
      return Number.isFinite(number) ? number : fallback();
    }
    case "bool":
      return value ? 1 : 0;
    case "color": {
      const rgb = hexToRgb(value) || (Array.isArray(value) ? value : null);
      return rgb ? toVector(rgb, 3) : fallback();
    }
    case "vec2":
    case "vec3":
    case "vec4":
      return Array.isArray(value)
        ? toVector(value, VECTOR_SIZES[param.type])
        : fallback();
    default: {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback();
    }
  }
}

export function uploadUniform(gl, location, type, value) {
  switch (type) {
    case "int":
    case "enum":
    case "bool":
      gl.uniform1i(location, value);
      break;
    case "vec2":
      gl.uniform2fv(location, value);
      break;
    case "vec3":
    case "color":
      gl.uniform3fv(location, value);
      break;
    case "vec4":
      gl.uniform4fv(location, value);
      break;
    default:
      gl.uniform1f(location, value);
  }
}
