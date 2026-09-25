import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFragmentSource, mapErrorLines } from "../src/gl/fragment.js";
import { uniformValue } from "../src/gl/uniforms.js";
import { AdaptiveScale } from "../src/gl/adaptiveScale.js";

test("fragment source declares param uniforms and maps error lines", () => {
  const manifest = {
    params: [
      { name: "tint", type: "color" },
      { name: "mode", type: "enum", values: ["a"] },
    ],
    shader: { code: "vec3 shader(vec2 uv, float time) {\n  return oops;\n}" },
  };
  const { source, lineOffset } = buildFragmentSource(manifest);
  assert.match(source, /uniform vec3 tint;/);
  assert.match(source, /uniform int mode;/);
  const lines = source.split("\n");
  assert.equal(lines[lineOffset + 1], "  return oops;");
  const log = `ERROR: 0:${lineOffset + 2}: 'oops' : undeclared identifier\0`;
  assert.equal(
    mapErrorLines(log, lineOffset),
    "ERROR: line 2: 'oops' : undeclared identifier"
  );
});

test("uniformValue produces upload-ready values", () => {
  assert.deepEqual(
    [...uniformValue({ type: "color" }, "#ff0000")],
    [1, 0, 0]
  );
  assert.deepEqual([...uniformValue({ type: "color" }, "nope")], [1, 1, 1]);
  assert.deepEqual([...uniformValue({ type: "vec3" }, [1, 2])], [1, 2, 0]);
  assert.deepEqual(
    [...uniformValue({ type: "vec2", default: [3, 4] }, undefined)],
    [3, 4]
  );
  assert.equal(uniformValue({ type: "int" }, "7.9"), 7);
  assert.equal(uniformValue({ type: "bool" }, true), 1);
  assert.equal(uniformValue({ type: "float", default: 0.5 }, null), 0.5);
});

function run(scaler, fpsForScale, seconds, start = 0) {
  let now = start;
  const end = start + seconds * 1000;
  while (now < end) {
    now += 1000 / fpsForScale(scaler.scale);
    scaler.sample(now);
  }
  return now;
}

test("adaptive scale drops resolution when GPU bound", () => {
  const scaler = new AdaptiveScale();
  // Frame rate proportional to 1 / pixel count; 20 fps at full scale.
  const gpuBound = (scale) => Math.min(60, 20 / (scale * scale));
  run(scaler, gpuBound, 20);
  assert.ok(scaler.scale < 0.75, `scale ${scaler.scale}`);
  assert.ok(scaler.scale > 0.45, `scale ${scaler.scale}`);
});

test("adaptive scale keeps full resolution on a 30 Hz display", () => {
  const scaler = new AdaptiveScale();
  run(scaler, () => 30, 20);
  assert.equal(scaler.scale, 1);
});

test("adaptive scale recovers when load goes away", () => {
  const scaler = new AdaptiveScale();
  const end = run(scaler, (scale) => Math.min(60, 20 / (scale * scale)), 10);
  run(scaler, () => 60, 30, end);
  assert.equal(scaler.scale, 1);
});

test("fixed scale never changes", () => {
  const scaler = new AdaptiveScale({ fixed: 0.5 });
  run(scaler, () => 10, 5);
  assert.equal(scaler.scale, 0.5);
});

test("adaptive scale still reacts on a device rendering 2 fps", () => {
  const scaler = new AdaptiveScale();
  run(scaler, (scale) => Math.min(60, 2 / (scale * scale)), 20);
  assert.equal(scaler.scale, scaler.min);
});
