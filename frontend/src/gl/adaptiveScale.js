const WINDOW_MS = 750;
// Gaps longer than this are pauses (hidden tab, debugger), not slow frames.
// Kept high so a device rendering at 1-2 fps is still measured and scaled.
const STALL_MS = 2000;

// Adjusts the render scale (fraction of the canvas CSS size) from measured
// frame rates. Drops resolution when frames are slow, creeps back up when
// there is headroom, and detects refresh-limited displays (e.g. a 30 Hz TV):
// if lowering the scale does not raise the frame rate, the GPU was not the
// bottleneck, so the previous scale is restored and the target lowered.
export class AdaptiveScale {
  constructor({ min = 0.35, max = 1, fixed = null } = {}) {
    this.min = min;
    this.max = max;
    this.fixed = fixed;
    this.scale = fixed ?? max;
    this.target = 60;
    this.fps = 0;
    this.upDelay = 3000;
    this.lastChange = 0;
    this.probe = null;
    this.upAttempt = false;
    this.measured = false;
    this.reset();
  }

  reset() {
    this.last = null;
    this.windowStart = null;
    this.frames = 0;
  }

  // Feed one frame timestamp. Returns true when the scale changed.
  // `measured` is true right after a measurement window completed.
  sample(now) {
    this.measured = false;
    if (this.last === null || now - this.last > STALL_MS) {
      // First frame, or the loop was paused / the tab hidden: restart timing.
      this.last = now;
      this.windowStart = now;
      this.frames = 0;
      return false;
    }
    this.last = now;
    this.frames += 1;
    if (now - this.windowStart < WINDOW_MS) {
      return false;
    }
    this.fps = (this.frames * 1000) / (now - this.windowStart);
    this.windowStart = now;
    this.frames = 0;
    this.measured = true;
    return this.fixed === null ? this.adjust(now) : false;
  }

  adjust(now) {
    const { fps } = this;

    if (this.probe) {
      const probe = this.probe;
      this.probe = null;
      if (fps < probe.fps * 1.08) {
        this.target = Math.max(1, probe.fps * 1.05);
        return this.setScale(probe.scale, now);
      }
    }

    if (fps < this.target * 0.85) {
      if (this.upAttempt) {
        this.upDelay = Math.min(60000, this.upDelay * 2);
      }
      this.upAttempt = false;
      if (this.scale <= this.min) return false;
      this.probe = { fps, scale: this.scale };
      const step = Math.min(0.92, Math.max(0.7, Math.sqrt(fps / this.target)));
      return this.setScale(Math.max(this.min, this.scale * step), now);
    }

    this.upAttempt = false;
    if (
      fps >= this.target * 0.95 &&
      this.scale < this.max &&
      now - this.lastChange > this.upDelay
    ) {
      this.upAttempt = true;
      return this.setScale(Math.min(this.max, this.scale * 1.12), now);
    }
    return false;
  }

  setScale(scale, now) {
    this.lastChange = now;
    if (scale === this.scale) return false;
    this.scale = scale;
    return true;
  }
}
