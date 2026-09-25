import { test } from "node:test";
import assert from "node:assert/strict";
import { createControlHandler, handleSocketMessage } from "../src/ws/handler.js";

function fakeState() {
  const calls = [];
  return {
    calls,
    sent: [],
    send(socket, message) {
      this.sent.push(message);
    },
    applyParamPatch: (params, origin) => calls.push(["patch", params, origin]),
    setShader: async (id) => (calls.push(["shader", id]), true),
    applyPreset: async (id) => (calls.push(["preset", id]), false),
    setBpm: (bpm) => (calls.push(["bpm", bpm]), true),
    syncBeat: () => calls.push(["sync"]),
  };
}

test("sockets can only ping; control messages over WS are ignored", () => {
  const state = fakeState();
  handleSocketMessage(state, {}, Buffer.from('{"type":"shader:set","payload":{"shaderId":1}}'));
  handleSocketMessage(state, {}, Buffer.from("not json"));
  handleSocketMessage(state, {}, Buffer.from('{"type":"clock:ping","payload":{"t0":5}}'));
  assert.deepEqual(state.calls, []);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].payload.t0, 5);
});

test("control handler validates ids and forwards the origin", async () => {
  const state = fakeState();
  const control = createControlHandler(state);
  assert.equal(control.has("clock:ping"), false);
  assert.equal(control.has("toString"), false);
  assert.equal(await control.run("shader:set", { shaderId: "x" }), false);
  assert.equal(await control.run("shader:set", { shaderId: 3 }), true);
  assert.equal(await control.run("preset:load", { presetId: 9 }), false);
  const origin = {};
  control.run("state:patch", { params: { a: 1 } }, origin);
  assert.deepEqual(state.calls, [
    ["shader", 3],
    ["preset", 9],
    ["patch", { a: 1 }, origin],
  ]);
});
