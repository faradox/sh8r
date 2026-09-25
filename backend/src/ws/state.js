import { randomUUID } from "node:crypto";
import * as shaderDb from "../db/shaders.js";
import * as presetDb from "../db/presets.js";
import { deriveDefaultParams, sanitizeParams } from "../params.js";

export const BPM_MIN = 20;
export const BPM_MAX = 300;
const BEATS_PER_BAR = 4;

const defaultDb = {
  listShaders: shaderDb.listShaders,
  getShaderById: shaderDb.getShaderById,
  getPresetById: presetDb.getPresetById,
};

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

// Moves the beat epoch so the current position within the bar is kept when
// the tempo changes, avoiding a visible jump in the beat/bar uniforms.
export function rebaseBeatEpoch(epoch, oldBpm, newBpm, now) {
  const barPosition = mod((now - epoch) / (60000 / oldBpm), BEATS_PER_BAR);
  return now - barPosition * (60000 / newBpm);
}

export function createState({ db = defaultDb, now = Date.now } = {}) {
  const state = {
    shaderId: null,
    manifest: null,
    params: {},
    bpm: 120,
    // Server timestamp (ms) of a bar start; clients derive beat/bar from it.
    beatEpoch: now(),
  };

  const clients = new Set();
  const clientsById = new Map();
  let shaderRequest = 0;

  function send(socket, message) {
    if (socket?.readyState === 1) {
      socket.send(typeof message === "string" ? message : JSON.stringify(message));
    }
  }

  function broadcast(message, { except } = {}) {
    const payload = JSON.stringify(message);
    for (const socket of clients) {
      if (socket !== except) send(socket, payload);
    }
  }

  function snapshot() {
    return {
      shaderId: state.shaderId,
      params: state.params,
      bpm: state.bpm,
      beatEpoch: state.beatEpoch,
    };
  }

  // A patch carrying shaderId replaces the whole param set on clients.
  function broadcastShader() {
    broadcast({
      type: "state:patch",
      payload: { shaderId: state.shaderId, params: state.params },
    });
  }

  async function initFromDatabase() {
    const shaders = await db.listShaders();
    if (shaders.length > 0) {
      await setShader(shaders[0].id, { broadcastChange: false });
    }
  }

  async function setShader(shaderId, { broadcastChange = true, params } = {}) {
    const request = ++shaderRequest;
    const shader = await db.getShaderById(shaderId);
    // A newer request finished first or is still pending; drop this one.
    if (!shader || request !== shaderRequest) {
      return false;
    }
    state.shaderId = shader.id;
    state.manifest = shader.manifest;
    state.params = {
      ...deriveDefaultParams(shader.manifest),
      ...sanitizeParams(shader.manifest, params),
    };
    if (broadcastChange) {
      broadcastShader();
    }
    return true;
  }

  function clearShader() {
    shaderRequest += 1;
    state.shaderId = null;
    state.manifest = null;
    state.params = {};
    broadcastShader();
  }

  async function handleShaderDeleted(shaderId) {
    if (state.shaderId !== shaderId) return;
    const shaders = await db.listShaders();
    const next = shaders.find((shader) => shader.id !== shaderId);
    if (!next || !(await setShader(next.id))) {
      clearShader();
    }
  }

  function applyParamPatch(paramPatch, origin) {
    const clean = sanitizeParams(state.manifest, paramPatch);
    if (Object.keys(clean).length === 0) {
      return;
    }
    state.params = { ...state.params, ...clean };
    // The sender already applied the change locally; echoing it back would
    // make its sliders jump to stale values while dragging.
    broadcast({ type: "state:patch", payload: { params: clean } }, { except: origin });
  }

  function setBpm(bpm, beatEpoch) {
    const numeric = Number(bpm);
    if (!Number.isFinite(numeric)) {
      return false;
    }
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, numeric));
    const current = now();
    state.beatEpoch = Number.isFinite(beatEpoch)
      ? beatEpoch
      : rebaseBeatEpoch(state.beatEpoch, state.bpm, next, current);
    state.bpm = next;
    broadcast({
      type: "state:patch",
      payload: { bpm: state.bpm, beatEpoch: state.beatEpoch },
    });
    return true;
  }

  function syncBeat() {
    state.beatEpoch = now();
    broadcast({ type: "state:patch", payload: { beatEpoch: state.beatEpoch } });
  }

  async function applyPreset(presetId) {
    const preset = await db.getPresetById(presetId);
    if (!preset) {
      return false;
    }
    return setShader(preset.shader_id, { params: preset.params });
  }

  function addClient(socket) {
    const clientId = randomUUID();
    clients.add(socket);
    clientsById.set(clientId, socket);
    send(socket, { type: "state:init", payload: { ...snapshot(), clientId } });
    socket.on("close", () => {
      clients.delete(socket);
      clientsById.delete(clientId);
    });
  }

  function findClient(clientId) {
    return clientId ? clientsById.get(clientId) : undefined;
  }

  function closeAll() {
    for (const socket of clients) {
      socket.close(1001, "Server shutting down");
    }
    clients.clear();
    clientsById.clear();
  }

  return {
    state,
    clients,
    broadcast,
    send,
    initFromDatabase,
    addClient,
    findClient,
    closeAll,
    setShader,
    handleShaderDeleted,
    applyPreset,
    applyParamPatch,
    setBpm,
    syncBeat,
  };
}
