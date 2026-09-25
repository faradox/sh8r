// Per-param motion declared in the manifest:
// - `lag` (seconds) eases a uniform towards the VJ's value instead of jumping,
//   so a control change unfolds over a few seconds.
// - `integrate` hands the shader the running total of the value instead of
//   the value itself, so a speed control changes a rate without the phase
//   jumping. "time" accumulates per second, "beat" per beat, with most of
//   each beat's step landing right on the beat.

const EASABLE = new Set(["float", "vec2", "vec3", "vec4", "color"]);
export const INTEGRATE_MODES = ["time", "beat"];

// Longer frame gaps (a stalled tab) are treated as this long so nothing
// lurches when rendering resumes.
const MAX_STEP = 0.25;

// Beat phases moving backwards by less than this are clock corrections,
// not a new beat.
const BACKWARD_TOLERANCE = 0.25;

export function lagOf(param) {
  const lag = Number(param.lag);
  return EASABLE.has(param.type) && Number.isFinite(lag) && lag > 0 ? lag : 0;
}

export function integrateOf(param) {
  return param.type === "float" && INTEGRATE_MODES.includes(param.integrate)
    ? param.integrate
    : null;
}

export function hasMotion(param) {
  return lagOf(param) > 0 || integrateOf(param) !== null;
}

// Fast attack, soft landing: 1 - (1 - phase)^3.
export function beatEase(phase) {
  const rest = 1 - phase;
  return 1 - rest * rest * rest;
}

// How far the eased beat clock moved between two beat phases (0..1), in
// beats. Returns null for a small backward jump, which should be skipped.
export function beatAdvance(from, to) {
  if (to >= from) return beatEase(to) - beatEase(from);
  if (from - to < BACKWARD_TOLERANCE) return null;
  return 1 + beatEase(to) - beatEase(from);
}

function copyValue(value) {
  return typeof value === "number" ? value : Float32Array.from(value);
}

// State for one param, starting at its current target so a freshly
// installed shader does not glide in from zero.
export function createMotion(param, target) {
  return {
    lag: lagOf(param),
    integrate: integrateOf(param),
    mid: copyValue(target),
    value: copyValue(target),
    total: 0,
  };
}

// Two cascaded one-pole filters: the response starts gently, then settles,
// reaching half way after about 0.84 * lag seconds.
function ease(state, target, dt) {
  if (state.lag <= 0) {
    state.value = copyValue(target);
    return;
  }
  const k = 1 - Math.exp((-2 * dt) / state.lag);
  if (typeof target === "number") {
    state.mid += (target - state.mid) * k;
    state.value += (state.mid - state.value) * k;
    return;
  }
  for (let i = 0; i < target.length; i += 1) {
    state.mid[i] += (target[i] - state.mid[i]) * k;
    state.value[i] += (state.mid[i] - state.value[i]) * k;
  }
}

// Advances one param by `dt` seconds and `beats` eased beats; returns the
// value to upload.
export function stepMotion(state, target, dt, beats) {
  ease(state, target, dt);
  if (!state.integrate) return state.value;
  state.total += state.value * (state.integrate === "beat" ? beats : dt);
  return state.total;
}

export function frameStep(seconds) {
  return Math.min(Math.max(seconds, 0), MAX_STEP);
}
