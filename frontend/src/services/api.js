function getDefaultApiUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  return `${window.location.protocol}//${window.location.host}`;
}

const API_BASE = import.meta.env.VITE_API_URL || getDefaultApiUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message =
      response.status === 401
        ? "Not authorized: log in via the VJ page"
        : typeof error.error === "string"
          ? error.error
          : "Request failed";
    throw Object.assign(new Error(message), { status: response.status });
  }

  if (response.status === 204) {
    return null;
  }
  return await response.json();
}

// Shaders are immutable on the server, so a fetched shader never goes stale.
const shaderCache = new Map();

export function listShaders() {
  return request("/api/shaders");
}

export function getShader(id) {
  if (!shaderCache.has(id)) {
    const pending = request(`/api/shaders/${id}`);
    pending.catch(() => shaderCache.delete(id));
    shaderCache.set(id, pending);
  }
  return shaderCache.get(id);
}

export function submitShader(payload) {
  return request("/api/shaders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteShader(id) {
  await request(`/api/shaders/${id}`, { method: "DELETE" });
  shaderCache.delete(id);
}

export function listPresets(shaderId) {
  const query = shaderId ? `?shader_id=${shaderId}` : "";
  return request(`/api/presets${query}`);
}

export function createPreset(payload) {
  return request("/api/presets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deletePreset(id) {
  return request(`/api/presets/${id}`, { method: "DELETE" });
}

export function sendControl(command) {
  return request("/api/control", {
    method: "POST",
    body: JSON.stringify(command),
  });
}
