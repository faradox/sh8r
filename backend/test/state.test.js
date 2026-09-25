import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createState, rebaseBeatEpoch } from "../src/ws/state.js";

const manifest = {
  params: [{ name: "speed", type: "float", default: 1, min: 0, max: 4 }],
};

function fakeDb() {
  const shaders = new Map([
    [1, { id: 1, manifest }],
    [2, { id: 2, manifest: { params: [] } }],
  ]);
  return {
    shaders,
    listShaders: async () => [...shaders.values()].reverse(),
    getShaderById: async (id) => shaders.get(id) || null,
    getPresetById: async (id) =>
      id === 7 ? { id: 7, shader_id: 1, params: { speed: 9, junk: 1 } } : null,
  };
}

function fakeSocket() {
  const socket = new EventEmitter();
  socket.readyState = 1;
  socket.messages = [];
  socket.send = (data) => socket.messages.push(JSON.parse(data));
  return socket;
}

test("rebaseBeatEpoch keeps the bar position across tempo changes", () => {
  // 1.5 beats into a bar at 120 bpm (500 ms per beat).
  const epoch = rebaseBeatEpoch(0, 120, 60, 750);
  assert.equal((750 - epoch) / 1000, 1.5);
});

test("new clients receive a full snapshot", async () => {
  const state = createState({ db: fakeDb(), now: () => 1000 });
  await state.setShader(1, { broadcastChange: false });
  const socket = fakeSocket();
  state.addClient(socket);
  const { clientId, ...snapshot } = socket.messages[0].payload;
  assert.equal(socket.messages[0].type, "state:init");
  assert.deepEqual(snapshot, {
    shaderId: 1,
    params: { speed: 1 },
    bpm: 120,
    beatEpoch: 1000,
  });
  assert.equal(state.findClient(clientId), socket);
  socket.emit("close");
  assert.equal(state.findClient(clientId), undefined);
});

test("param patches are sanitized and not echoed to the sender", async () => {
  const state = createState({ db: fakeDb() });
  await state.setShader(1, { broadcastChange: false });
  const vj = fakeSocket();
  const live = fakeSocket();
  state.addClient(vj);
  state.addClient(live);
  state.applyParamPatch({ speed: 10, other: 1 }, vj);
  assert.equal(vj.messages.length, 1);
  assert.deepEqual(live.messages[1].payload, { params: { speed: 4 } });
  assert.equal(state.state.params.speed, 4);
});

test("presets merge sanitized params over defaults", async () => {
  const state = createState({ db: fakeDb() });
  assert.equal(await state.applyPreset(7), true);
  assert.deepEqual(state.state.params, { speed: 4 });
  assert.equal(await state.applyPreset(8), false);
});

test("deleting the live shader falls back to another one", async () => {
  const db = fakeDb();
  const state = createState({ db });
  await state.setShader(1, { broadcastChange: false });
  db.shaders.delete(1);
  await state.handleShaderDeleted(1);
  assert.equal(state.state.shaderId, 2);
  db.shaders.delete(2);
  await state.handleShaderDeleted(2);
  assert.equal(state.state.shaderId, null);
});

test("slower shader lookups do not override newer selections", async () => {
  const db = fakeDb();
  const original = db.getShaderById;
  db.getShaderById = async (id) => {
    if (id === 1) await new Promise((resolve) => setTimeout(resolve, 20));
    return original(id);
  };
  const state = createState({ db });
  await Promise.all([state.setShader(1), state.setShader(2)]);
  assert.equal(state.state.shaderId, 2);
});

test("bpm is clamped and rebased", () => {
  let now = 0;
  const state = createState({ db: fakeDb(), now: () => now });
  now = 250;
  state.setBpm(1000);
  assert.equal(state.state.bpm, 300);
  assert.equal(state.setBpm("nope"), false);
  state.setBpm(90, 42);
  assert.equal(state.state.beatEpoch, 42);
});
