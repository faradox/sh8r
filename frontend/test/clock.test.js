import { test } from "node:test";
import assert from "node:assert/strict";
import { beatPhase, createClockSync, createTapTempo } from "../src/lib/clock.js";

test("beatPhase derives beat and bar phase", () => {
  const phase = beatPhase(1250, 120, 0);
  assert.equal(phase.beat, 0.5);
  assert.equal(phase.bar, 0.625);
  assert.equal(beatPhase(-250, 120, 0).beat, 0.5);
});

test("clock sync prefers the lowest round trip sample", () => {
  const sync = createClockSync();
  sync.addSample(0, 1100, 200);
  sync.addSample(1000, 2010, 1020);
  assert.equal(sync.offset, 1000);
  assert.equal(sync.rtt, 20);
  sync.addSample(0, 5, -1);
  assert.equal(sync.rtt, 20);
});

test("tap tempo averages intervals and restarts after a pause", () => {
  const tapper = createTapTempo();
  assert.equal(tapper.tap(0), null);
  tapper.tap(500);
  const result = tapper.tap(1000);
  assert.equal(result.bpm, 120);
  assert.equal(result.firstTap, 0);
  assert.equal(tapper.tap(5000), null);
});
