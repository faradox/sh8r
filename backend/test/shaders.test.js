import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../src/routes/shaders.js";

function manifest(params) {
  return {
    meta: { title: "Test" },
    params,
    shader: { entry: "shader", code: "vec3 shader(vec2 uv, float time) {}" },
  };
}

test("validateManifest accepts lag and integrate on float params", () => {
  const result = validateManifest(
    manifest([
      { name: "drift", type: "float", lag: 3, integrate: "beat" },
      { name: "tint", type: "color", lag: 2 },
    ])
  );
  assert.equal(result.ok, true);
});

test("validateManifest rejects bad motion fields", () => {
  const cases = [
    [{ name: "a", type: "float", lag: -1 }, /lag/],
    [{ name: "a", type: "float", integrate: "forever" }, /integrate/],
    [{ name: "a", type: "vec2", integrate: "time" }, /Only float/],
    [{ name: "time", type: "float" }, /Reserved/],
  ];
  for (const [param, pattern] of cases) {
    const result = validateManifest(manifest([param]));
    assert.equal(result.ok, false);
    assert.match(result.error, pattern);
  }
});
