import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultValue,
  deriveDefaultParams,
  sanitizeParams,
  sanitizeValue,
} from "../src/params.js";

test("defaultValue normalizes every type", () => {
  assert.equal(defaultValue({ type: "float", default: 5, max: 2 }), 2);
  assert.equal(defaultValue({ type: "int", default: 3.7 }), 3);
  assert.equal(defaultValue({ type: "bool" }), false);
  assert.equal(
    defaultValue({ type: "enum", values: ["a", "b"], default: "b" }),
    1
  );
  assert.equal(defaultValue({ type: "enum", values: ["a"], default: "x" }), 0);
  assert.deepEqual(defaultValue({ type: "vec3", default: [1] }), [1, 0, 0]);
  assert.equal(defaultValue({ type: "color", default: "#F0a" }), "#ff00aa");
  assert.equal(defaultValue({ type: "color" }), "#ffffff");
});

test("sanitizeValue rejects malformed input", () => {
  assert.equal(sanitizeValue({ type: "float" }, "abc"), undefined);
  assert.equal(sanitizeValue({ type: "bool" }, "true"), undefined);
  assert.equal(sanitizeValue({ type: "enum", values: ["a"] }, 3), undefined);
  assert.equal(sanitizeValue({ type: "vec2" }, [1]), undefined);
  assert.equal(sanitizeValue({ type: "color" }, "red"), undefined);
});

test("sanitizeValue clamps numbers and converts colors", () => {
  assert.equal(sanitizeValue({ type: "float", min: 0, max: 1 }, 4), 1);
  assert.equal(sanitizeValue({ type: "int", min: 3 }, -2.5), 3);
  assert.deepEqual(sanitizeValue({ type: "vec2", max: 1 }, [2, "0.5"]), [1, 0.5]);
  assert.equal(sanitizeValue({ type: "color" }, [1, 0, 0.5]), "#ff0080");
});

test("sanitizeParams drops unknown and invalid keys", () => {
  const manifest = {
    params: [
      { name: "speed", type: "float" },
      { name: "on", type: "bool" },
    ],
  };
  assert.deepEqual(
    sanitizeParams(manifest, { speed: "2", on: 1, extra: 5 }),
    { speed: 2 }
  );
  assert.deepEqual(sanitizeParams(null, { speed: 1 }), {});
  assert.deepEqual(deriveDefaultParams(manifest), { speed: 0, on: false });
});
