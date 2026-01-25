function getDefaultApiUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  return `${window.location.protocol}//${window.location.host}`;
}

const API_BASE = import.meta.env.VITE_API_URL || getDefaultApiUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }
  return await response.json();
}

export function listShaders() {
  return request("/api/shaders");
}

export function getShader(id) {
  return request(`/api/shaders/${id}`);
}

export function submitShader(payload) {
  return request("/api/shaders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteShader(id) {
  return request(`/api/shaders/${id}`, { method: "DELETE" });
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

export function loadPreset(id) {
  return request(`/api/presets/${id}/load`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
