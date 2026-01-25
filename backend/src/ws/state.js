import { listShaders, getShaderById } from "../db/shaders.js";
import { getPresetById } from "../db/presets.js";

function isValidIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function normalizeParamDefault(param) {
  if (param.type === "color") {
    return typeof param.default === "string" ? param.default : "#ffffff";
  }
  if (param.type === "vec2" || param.type === "vec3" || param.type === "vec4") {
    return Array.isArray(param.default) ? param.default : [];
  }
  if (param.type === "bool") {
    return Boolean(param.default);
  }
  if (param.type === "int") {
    return Number.isFinite(param.default) ? Math.trunc(param.default) : 0;
  }
  if (param.type === "float") {
    return Number.isFinite(param.default) ? param.default : 0;
  }
  if (param.type === "enum") {
    const values = Array.isArray(param.values) ? param.values : [];
    const defaultValue = param.default;
    const defaultIndex = values.indexOf(defaultValue);
    return defaultIndex >= 0 ? defaultIndex : 0;
  }
  return param.default ?? null;
}

function deriveDefaultParams(manifest) {
  if (!manifest || !Array.isArray(manifest.params)) {
    return {};
  }
  const result = {};
  for (const param of manifest.params) {
    if (!param?.name || !isValidIdentifier(param.name)) {
      continue;
    }
    result[param.name] = normalizeParamDefault(param);
  }
  return result;
}

export function createState() {
  const state = {
    shaderId: null,
    shaderManifest: null,
    params: {},
    bpm: 120,
  };

  const clients = new Set();

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const socket of clients) {
      if (socket?.readyState === 1) {
        socket.send(payload);
      }
    }
  }

  async function initFromDatabase() {
    const shaders = await listShaders();
    if (shaders.length === 0) {
      return;
    }
    const latestShader = shaders[0];
    await setShader(latestShader.id, { broadcastChange: false });
  }

  async function setShader(shaderId, { broadcastChange = true } = {}) {
    const shader = await getShaderById(shaderId);
    if (!shader) {
      return false;
    }
    state.shaderId = shader.id;
    state.shaderManifest = shader.manifest;
    state.params = deriveDefaultParams(shader.manifest);
    if (broadcastChange) {
      broadcast({
        type: "shader:set",
        payload: { shaderId: shader.id },
      });
      broadcast({
        type: "state:patch",
        payload: { shaderId: shader.id, params: state.params },
      });
    }
    return true;
  }

  function applyParamPatch(paramPatch) {
    if (!paramPatch || typeof paramPatch !== "object") {
      return;
    }
    state.params = { ...state.params, ...paramPatch };
    broadcast({
      type: "state:patch",
      payload: { params: paramPatch },
    });
  }

  function setBpm(bpm) {
    const numericBpm = Number(bpm);
    if (!Number.isFinite(numericBpm) || numericBpm <= 0) {
      return false;
    }
    state.bpm = numericBpm;
    broadcast({
      type: "bpm:set",
      payload: { bpm: state.bpm },
    });
    broadcast({
      type: "state:patch",
      payload: { bpm: state.bpm },
    });
    return true;
  }

  async function applyPreset(presetId) {
    const preset = await getPresetById(presetId);
    if (!preset) {
      return false;
    }
    const didSet = await setShader(preset.shader_id, { broadcastChange: false });
    if (!didSet) {
      return false;
    }
    state.params = preset.params || {};
    broadcast({
      type: "preset:load",
      payload: { presetId: preset.id, shaderId: preset.shader_id },
    });
    broadcast({
      type: "state:patch",
      payload: { shaderId: preset.shader_id, params: state.params },
    });
    return true;
  }

  function addClient(connection) {
    const socket = connection?.socket ?? connection;
    if (!socket) {
      return;
    }
    clients.add(socket);
    socket.send(
      JSON.stringify({
        type: "state:init",
        payload: {
          shaderId: state.shaderId,
          params: state.params,
          bpm: state.bpm,
        },
      })
    );
    socket.on("close", () => {
      clients.delete(socket);
    });
  }

  return {
    state,
    initFromDatabase,
    addClient,
    setShader,
    applyPreset,
    applyParamPatch,
    setBpm,
  };
}
