import {
  VERTEX_SOURCE,
  buildFragmentSource,
  mapErrorLines,
  shaderParams,
} from "./fragment.js";
import { uniformValue, uploadUniform } from "./uniforms.js";
import { AdaptiveScale } from "./adaptiveScale.js";
import {
  beatAdvance,
  createMotion,
  frameStep,
  hasMotion,
  stepMotion,
} from "./motion.js";

const CONTEXT_OPTIONS = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
};

const BUILTINS = ["time", "resolution", "bpm", "beat", "bar"];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Owns one canvas (created inside `container`) and its WebGL context. Shaders are swapped in place: a new
// program is compiled (in the background where the browser supports it)
// while the previous one keeps rendering, and a failed compile leaves the
// previous shader on screen.
export class ShaderEngine {
  constructor(container, options = {}) {
    // The engine creates its own canvas so a destroyed engine can release
    // its context immediately; browsers cap the number of live contexts.
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    this.options = {
      maxDpr: 1,
      maxPixels: 1920 * 1080,
      scale: null,
      onStats: null,
      ...options,
    };
    this.scaler = new AdaptiveScale({ fixed: this.options.scale });
    this.clock = () => ({ bpm: 120, beat: 0, bar: 0 });
    this.params = {};
    this.paramsDirty = false;
    this.manifest = null;
    this.current = null;
    this.compileToken = 0;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.needsResize = true;
    this.visible = true;
    this.paused = false;
    this.lost = false;
    this.rafId = null;
    this.frame = this.frame.bind(this);

    this.gl =
      canvas.getContext("webgl", CONTEXT_OPTIONS) ||
      canvas.getContext("experimental-webgl", CONTEXT_OPTIONS);
    if (!this.gl) {
      throw new Error("WebGL is not supported on this device");
    }
    container.appendChild(canvas);
    this.initResources();

    this.onContextLost = (event) => {
      event.preventDefault();
      this.lost = true;
      this.current = null;
      this.compileToken += 1;
      this.updateLoop();
    };
    this.onContextRestored = () => {
      this.lost = false;
      this.initResources();
      this.needsResize = true;
      if (this.manifest) this.setShader(this.manifest);
    };
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);

    const rect = canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      this.cssWidth = width;
      this.cssHeight = height;
      this.needsResize = true;
    });
    this.resizeObserver.observe(canvas);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      this.updateLoop();
    });
    this.intersectionObserver.observe(canvas);

    // rAF stops silently in hidden tabs; restart frame timing on return.
    this.onVisibility = () => this.scaler.reset();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  initResources() {
    const gl = this.gl;
    this.parallel = gl.getExtension("KHR_parallel_shader_compile");
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(this.vertexShader, VERTEX_SOURCE);
    gl.compileShader(this.vertexShader);

    // One oversized triangle covers the viewport without a diagonal seam.
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  setClock(clock) {
    this.clock = clock;
  }

  setParams(params) {
    this.params = params || {};
    this.paramsDirty = true;
  }

  setPaused(paused) {
    this.paused = paused;
    this.updateLoop();
  }

  // Resolves to { ok, error, compileMs }. Superseded requests resolve with
  // { ok: false, superseded: true } and never touch the screen.
  async setShader(manifest) {
    const token = ++this.compileToken;
    this.manifest = manifest;
    if (!manifest) {
      this.clearProgram();
      return { ok: true };
    }
    if (this.lost) {
      return { ok: false, error: "WebGL context lost" };
    }

    const gl = this.gl;
    const started = performance.now();
    const { source, lineOffset } = buildFragmentSource(manifest);
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragment, source);
    gl.compileShader(fragment);
    const program = gl.createProgram();
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    if (this.parallel) {
      const status = this.parallel.COMPLETION_STATUS_KHR;
      while (!gl.isContextLost() && !gl.getProgramParameter(program, status)) {
        await wait(16);
      }
    }

    const superseded = token !== this.compileToken || gl.isContextLost();
    let error = null;
    if (!superseded && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      error = gl.getShaderParameter(fragment, gl.COMPILE_STATUS)
        ? gl.getProgramInfoLog(program) || "Shader program link failed"
        : mapErrorLines(gl.getShaderInfoLog(fragment), lineOffset) ||
          "Fragment shader compile failed";
    }
    gl.deleteShader(fragment);

    if (superseded || error) {
      gl.deleteProgram(program);
      return superseded ? { ok: false, superseded: true } : { ok: false, error };
    }

    this.installProgram(program, manifest);
    return { ok: true, compileMs: Math.round(performance.now() - started) };
  }

  installProgram(program, manifest) {
    const gl = this.gl;
    if (this.current) gl.deleteProgram(this.current.program);

    const builtins = {};
    for (const name of BUILTINS) {
      builtins[name] = gl.getUniformLocation(program, name);
    }
    const params = shaderParams(manifest)
      .map((param) => {
        const location = gl.getUniformLocation(program, param.name);
        const target = uniformValue(param, this.params[param.name]);
        const motion = hasMotion(param) ? createMotion(param, target) : null;
        return { param, location, target, motion };
      })
      .filter((entry) => entry.location !== null);

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.current = {
      program,
      builtins,
      params,
      moving: params.filter((entry) => entry.motion),
      startTime: performance.now(),
      lastFrame: null,
      lastBeat: null,
    };
    this.paramsDirty = true;
    this.updateLoop();
  }

  clearProgram() {
    if (this.current && !this.lost) {
      this.gl.deleteProgram(this.current.program);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.current = null;
    this.updateLoop();
  }

  updateLoop() {
    const shouldRun =
      this.current && this.visible && !this.paused && !this.lost;
    if (shouldRun && this.rafId === null) {
      this.scaler.reset();
      this.rafId = requestAnimationFrame(this.frame);
    } else if (!shouldRun && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  applySize() {
    const { maxDpr, maxPixels } = this.options;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    let width = this.cssWidth * dpr * this.scaler.scale;
    let height = this.cssHeight * dpr * this.scaler.scale;
    if (width * height > maxPixels) {
      const shrink = Math.sqrt(maxPixels / (width * height));
      width *= shrink;
      height *= shrink;
    }
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    // Assigning canvas.width reallocates the drawing buffer, even when the
    // value is unchanged, so only touch it on a real change.
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
    this.needsResize = false;
  }

  frame(now) {
    this.rafId = requestAnimationFrame(this.frame);
    const gl = this.gl;
    const current = this.current;
    const { builtins, params, moving, startTime } = current;

    if (this.scaler.sample(now)) this.needsResize = true;
    if (this.needsResize) this.applySize();

    const { bpm, beat, bar } = this.clock();
    gl.uniform1f(builtins.time, (now - startTime) / 1000);
    gl.uniform2f(builtins.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(builtins.bpm, bpm);
    gl.uniform1f(builtins.beat, beat);
    gl.uniform1f(builtins.bar, bar);

    if (this.paramsDirty) {
      for (const entry of params) {
        entry.target = uniformValue(entry.param, this.params[entry.param.name]);
        if (!entry.motion) {
          uploadUniform(gl, entry.location, entry.param.type, entry.target);
        }
      }
      this.paramsDirty = false;
    }

    if (moving.length) {
      const elapsed = current.lastFrame === null ? 0 : now - current.lastFrame;
      const dt = frameStep(elapsed / 1000);
      let beats = 0;
      if (current.lastBeat === null) {
        current.lastBeat = beat;
      } else {
        const advance = beatAdvance(current.lastBeat, beat);
        if (advance !== null) {
          beats = advance;
          current.lastBeat = beat;
        }
      }
      for (const entry of moving) {
        const value = stepMotion(entry.motion, entry.target, dt, beats);
        uploadUniform(gl, entry.location, entry.param.type, value);
      }
    }
    current.lastFrame = now;

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (this.options.onStats && this.scaler.measured) {
      this.options.onStats({
        fps: Math.round(this.scaler.fps),
        scale: this.scaler.scale,
        width: this.canvas.width,
        height: this.canvas.height,
      });
    }
  }

  destroy() {
    this.compileToken += 1;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    if (!this.lost) {
      const gl = this.gl;
      if (this.current) gl.deleteProgram(this.current.program);
      gl.deleteShader(this.vertexShader);
      gl.deleteBuffer(this.buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.current = null;
    this.canvas.remove();
  }
}
