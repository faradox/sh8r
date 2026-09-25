// Mirrors backend/src/params.js (separate Docker build contexts prevent sharing).
// Keep the two files in sync when changing param semantics.

export const PARAM_TYPES = [
  "float",
  "int",
  "bool",
  "enum",
  "vec2",
  "vec3",
  "vec4",
  "color",
];

const VECTOR_SIZES = { vec2: 2, vec3: 3, vec4: 4 };

export function isValidIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function clamp(value, min, max) {
  let result = value;
  if (Number.isFinite(min)) result = Math.max(min, result);
  if (Number.isFinite(max)) result = Math.min(max, result);
  return result;
}

function toHexByte(unit) {
  const byte = Math.round(clamp(Number(unit) || 0, 0, 1) * 255);
  return byte.toString(16).padStart(2, "0");
}

function normalizeColor(value) {
  if (typeof value === "string") {
    const hex = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) {
      return "#" + [...hex.slice(1)].map((c) => c + c).join("");
    }
    return undefined;
  }
  if (Array.isArray(value) && value.length >= 3) {
    return "#" + value.slice(0, 3).map(toHexByte).join("");
  }
  return undefined;
}

function enumDefault(param) {
  const values = Array.isArray(param.values) ? param.values : [];
  const index = values.indexOf(param.default);
  if (index >= 0) return index;
  if (Number.isInteger(param.default) && param.default < values.length) {
    return Math.max(0, param.default);
  }
  return 0;
}

export function defaultValue(param) {
  switch (param.type) {
    case "color":
      return normalizeColor(param.default) ?? "#ffffff";
    case "bool":
      return Boolean(param.default);
    case "enum":
      return enumDefault(param);
    case "int":
      return Math.trunc(
        clamp(Number.isFinite(param.default) ? param.default : 0, param.min, param.max)
      );
    case "vec2":
    case "vec3":
    case "vec4": {
      const size = VECTOR_SIZES[param.type];
      const source = Array.isArray(param.default) ? param.default : [];
      return Array.from({ length: size }, (_, i) =>
        clamp(Number.isFinite(source[i]) ? source[i] : 0, param.min, param.max)
      );
    }
    default:
      return clamp(
        Number.isFinite(param.default) ? param.default : 0,
        param.min,
        param.max
      );
  }
}

// Returns the sanitized value, or undefined when the input is unusable.
export function sanitizeValue(param, value) {
  switch (param.type) {
    case "color":
      return normalizeColor(value);
    case "bool":
      return typeof value === "boolean" ? value : undefined;
    case "enum": {
      const count = Array.isArray(param.values) ? param.values.length : 0;
      const index = Math.trunc(Number(value));
      return Number.isFinite(index) && index >= 0 && index < count
        ? index
        : undefined;
    }
    case "int": {
      const number = Number(value);
      return Number.isFinite(number)
        ? Math.trunc(clamp(number, param.min, param.max))
        : undefined;
    }
    case "vec2":
    case "vec3":
    case "vec4": {
      const size = VECTOR_SIZES[param.type];
      if (!Array.isArray(value) || value.length < size) return undefined;
      const numbers = value.slice(0, size).map(Number);
      if (!numbers.every(Number.isFinite)) return undefined;
      return numbers.map((n) => clamp(n, param.min, param.max));
    }
    default: {
      const number = Number(value);
      return Number.isFinite(number)
        ? clamp(number, param.min, param.max)
        : undefined;
    }
  }
}

function manifestParams(manifest) {
  if (!Array.isArray(manifest?.params)) return [];
  return manifest.params.filter((param) => isValidIdentifier(param?.name));
}

export function deriveDefaultParams(manifest) {
  const result = {};
  for (const param of manifestParams(manifest)) {
    result[param.name] = defaultValue(param);
  }
  return result;
}

// Keeps only known params with valid values; unknown keys are dropped.
export function sanitizeParams(manifest, input) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const param of manifestParams(manifest)) {
    if (!Object.prototype.hasOwnProperty.call(input, param.name)) continue;
    const value = sanitizeValue(param, input[param.name]);
    if (value !== undefined) result[param.name] = value;
  }
  return result;
}
