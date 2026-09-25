import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beatAdvance,
  createMotion,
  hasMotion,
  stepMotion,
} from "../src/gl/motion.js";

function run(state, target, seconds, beatsPerSecond = 0) {
  const dt = 1 / 60;
  let value;
  for (let t = 0; t < seconds; t += dt) {
    value = stepMotion(state, target, dt, beatsPerSecond * dt);
  }
  return value;
}

test("hasMotion only applies to supported types", () => {
  assert.equal(hasMotion({ type: "float", lag: 2 }), true);
  assert.equal(hasMotion({ type: "color", lag: 2 }), true);
  assert.equal(hasMotion({ type: "int", lag: 2 }), false);
  assert.equal(hasMotion({ type: "vec2", integrate: "time" }), false);
  assert.equal(hasMotion({ type: "float", integrate: "beat" }), true);
  assert.equal(hasMotion({ type: "float" }), false);
});

test("lag starts at the target and eases towards new ones", () => {
  const state = createMotion({ type: "float", lag: 2 }, 0);
  assert.equal(stepMotion(state, 0, 1 / 60, 0), 0);
  const early = run(state, 1, 0.3);
  assert.ok(early > 0 && early < 0.1, `early ${early}`);
  const half = run(state, 1, 1.4);
  assert.ok(half > 0.4 && half < 0.7, `half ${half}`);
  assert.ok(run(state, 1, 10) > 0.999);
});

test("lag eases every vector component", () => {
  const state = createMotion({ type: "vec2", lag: 1 }, new Float32Array([0, 1]));
  const value = run(state, new Float32Array([1, 0]), 8);
  assert.ok(value[0] > 0.999 && value[1] < 0.001, `${value}`);
});

test("integrate accumulates per second or per beat", () => {
  const perSecond = createMotion({ type: "float", integrate: "time" }, 2);
  assert.ok(Math.abs(run(perSecond, 2, 3) - 6) < 0.1);
  const perBeat = createMotion({ type: "float", integrate: "beat" }, 0.5);
  assert.ok(Math.abs(run(perBeat, 0.5, 4, 2) - 4) < 0.1);
});

test("beatAdvance front-loads each beat and skips small backward jumps", () => {
  assert.ok(beatAdvance(0, 0.25) > 0.5);
  const wrap = beatAdvance(0.9, 0.1);
  assert.ok(wrap > 0.27 && wrap < 0.28, `wrap ${wrap}`);
  assert.equal(beatAdvance(0.5, 0.4), null);
  const total = beatAdvance(0, 0.5) + beatAdvance(0.5, 0.99) + beatAdvance(0.99, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});
