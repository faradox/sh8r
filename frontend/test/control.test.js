import { test } from "node:test";
import assert from "node:assert/strict";
import { createControlQueue } from "../src/services/control.js";

function deferredSender() {
  const sent = [];
  const waiting = [];
  return {
    sent,
    send: (command) =>
      new Promise((resolve) => {
        sent.push(command);
        waiting.push(resolve);
      }),
    finish: async () => {
      waiting.shift()();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

test("one request in flight; queued param patches are merged", async () => {
  const sender = deferredSender();
  const queue = createControlQueue({ send: sender.send, getClientId: () => "c1" });
  queue.push("state:patch", { params: { a: 1 } });
  queue.push("state:patch", { params: { a: 2 } });
  queue.push("state:patch", { params: { b: 3 } });
  queue.push("beat:sync", {});
  assert.equal(sender.sent.length, 1);
  await sender.finish();
  assert.deepEqual(sender.sent[1], {
    type: "state:patch",
    payload: { params: { a: 2, b: 3 } },
    clientId: "c1",
  });
  await sender.finish();
  assert.equal(sender.sent[2].type, "beat:sync");
});

test("errors are reported and the queue keeps going", async () => {
  const errors = [];
  let calls = 0;
  const queue = createControlQueue({
    send: async () => {
      calls += 1;
      if (calls === 1) throw new Error("Not authorized");
    },
    getClientId: () => null,
    onError: (error) => errors.push(error.message),
  });
  queue.push("shader:set", { shaderId: 1 });
  queue.push("shader:set", { shaderId: 2 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(errors, ["Not authorized"]);
  assert.equal(calls, 2);
});

test("pending param patches can be dropped on shader change", async () => {
  const sender = deferredSender();
  const queue = createControlQueue({ send: sender.send, getClientId: () => null });
  queue.push("shader:set", { shaderId: 1 });
  queue.push("state:patch", { params: { a: 1 } });
  queue.dropPendingParams();
  await sender.finish();
  assert.equal(sender.sent.length, 1);
});
