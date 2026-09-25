const BEATS_PER_BAR = 4;
const MAX_SAMPLES = 8;

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

// Monotonic wall clock in ms; Date.now() can jump when the OS adjusts time.
export function wallNow() {
  return performance.timeOrigin + performance.now();
}

export function beatPhase(serverNow, bpm, beatEpoch) {
  const beats = (serverNow - beatEpoch) / (60000 / bpm);
  return {
    beat: mod(beats, 1),
    bar: mod(beats / BEATS_PER_BAR, 1),
  };
}

// Estimates the offset between this client's clock and the server's using
// ping round trips; the sample with the lowest round trip time wins because
// it has the least uncertainty.
export function createClockSync() {
  const samples = [];
  const sync = {
    offset: 0,
    rtt: null,
    addSample(t0, serverTime, t1) {
      const rtt = t1 - t0;
      if (!Number.isFinite(rtt) || rtt < 0 || !Number.isFinite(serverTime)) {
        return;
      }
      samples.push({ rtt, offset: serverTime + rtt / 2 - t1 });
      if (samples.length > MAX_SAMPLES) samples.shift();
      const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
      sync.offset = best.offset;
      sync.rtt = best.rtt;
    },
    reset() {
      samples.length = 0;
    },
    serverNow() {
      return wallNow() + sync.offset;
    },
  };
  return sync;
}

// Averages tap intervals into a BPM. Returns null until two taps exist.
// A pause longer than `resetMs` starts a new tap sequence, whose first tap
// is treated as a downbeat.
export function createTapTempo({ resetMs = 2000, maxTaps = 8 } = {}) {
  let taps = [];
  let firstTap = null;
  return {
    tap(time) {
      if (taps.length && time - taps[taps.length - 1] > resetMs) {
        taps = [];
      }
      if (taps.length === 0) firstTap = time;
      taps.push(time);
      if (taps.length > maxTaps) taps.shift();
      if (taps.length < 2) return null;
      const span = taps[taps.length - 1] - taps[0];
      return {
        bpm: (60000 * (taps.length - 1)) / span,
        firstTap,
      };
    },
  };
}
