import React, { useEffect, useMemo, useRef, useState } from "react";
import { getShader } from "../services/api.js";

const vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const typeToGlsl = {
  float: "float",
  int: "int",
  bool: "bool",
  enum: "int",
  vec2: "vec2",
  vec3: "vec3",
  vec4: "vec4",
  color: "vec3",
};

function buildFragmentSource(manifest) {
  const params = Array.isArray(manifest?.params) ? manifest.params : [];
  const uniforms = params
    .map((param) => `uniform ${typeToGlsl[param.type] || "float"} ${param.name};`)
    .join("\n");

  return `
precision highp float;
uniform float time;
uniform vec2 resolution;
uniform float bpm;
uniform float beat;
uniform float bar;
${uniforms}
${manifest.shader.code}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec3 color = shader(uv, time);
  gl_FragColor = vec4(color, 1.0);
}
`;
}

function createProgram(gl, fragmentSource) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(vertexShader);
    gl.deleteShader(vertexShader);
    throw new Error(log || "Vertex shader compile failed");
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fragmentShader);
    gl.deleteShader(fragmentShader);
    throw new Error(log || "Fragment shader compile failed");
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || "Shader program link failed");
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

function normalizeParamValue(param, value) {
  if (param.type === "float") return Number(value) || 0;
  if (param.type === "int") return Math.trunc(Number(value) || 0);
  if (param.type === "bool") return value ? 1 : 0;
  if (param.type === "enum") return Math.trunc(Number(value) || 0);
  if (param.type === "vec2" || param.type === "vec3" || param.type === "vec4") {
    return Array.isArray(value) ? value.map(Number) : [];
  }
  if (param.type === "color") {
    if (typeof value === "string" && value.startsWith("#")) {
      const hex = value.slice(1);
      const parse = (start) =>
        parseInt(hex.slice(start, start + 2), 16) / 255;
      if (hex.length === 6) {
        return [parse(0), parse(2), parse(4)];
      }
    }
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    return [1, 1, 1];
  }
  return value;
}

export default function ShaderRenderer({
  shaderId,
  params,
  bpm,
  debug,
  onDebug,
}) {
  const canvasRef = useRef(null);
  const [shader, setShader] = useState(null);
  const [error, setError] = useState(null);
  const [fps, setFps] = useState(0);
  const [compileTimeMs, setCompileTimeMs] = useState(null);
  const [uniforms, setUniforms] = useState([]);
  const info = useMemo(
    () => ({ error, fps, compileTimeMs, uniforms }),
    [error, fps, compileTimeMs, uniforms]
  );

  useEffect(() => {
    if (typeof onDebug === "function") {
      onDebug(info);
    }
  }, [info, onDebug]);

  const paramsRef = useRef(params);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    if (!shaderId) {
      setShader(null);
      return;
    }
    getShader(shaderId)
      .then((data) => {
        setShader(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setShader(null);
      });
  }, [shaderId]);

  useEffect(() => {
    if (!shader || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) {
      setError("WebGL not supported");
      return;
    }

    const startTime = performance.now();
    let program;
    try {
      const fragmentSource = buildFragmentSource(shader.manifest);
      program = createProgram(gl, fragmentSource);
      setError(null);
      setCompileTimeMs(Math.round(performance.now() - startTime));
    } catch (err) {
      setError(err.message);
      return;
    }

    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "position");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uniformLocations = {
      time: gl.getUniformLocation(program, "time"),
      resolution: gl.getUniformLocation(program, "resolution"),
      bpm: gl.getUniformLocation(program, "bpm"),
      beat: gl.getUniformLocation(program, "beat"),
      bar: gl.getUniformLocation(program, "bar"),
    };

    const manifestParams = shader.manifest?.params || [];
    for (const param of manifestParams) {
      uniformLocations[param.name] = gl.getUniformLocation(
        program,
        param.name
      );
    }

    setUniforms([
      "time",
      "resolution",
      "bpm",
      "beat",
      "bar",
      ...manifestParams.map((param) => param.name),
    ]);

    let frames = 0;
    let fpsLast = performance.now();

    function resize() {
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = Math.max(1, Math.floor(width));
        canvas.height = Math.max(1, Math.floor(height));
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }

    let animationId;

    function render() {
      const now = performance.now();
      resize();

      const seconds = (now - startTime) / 1000;
      const bpmValue = bpmRef.current || 120;
      const beatDuration = 60 / bpmValue;
      const beat = (seconds / beatDuration) % 1;
      const bar = (seconds / (beatDuration * 4)) % 1;

      gl.useProgram(program);
      gl.uniform1f(uniformLocations.time, seconds);
      gl.uniform2f(uniformLocations.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniformLocations.bpm, bpmValue);
      gl.uniform1f(uniformLocations.beat, beat);
      gl.uniform1f(uniformLocations.bar, bar);

      for (const param of manifestParams) {
        const value = normalizeParamValue(
          param,
          paramsRef.current[param.name]
        );
        const location = uniformLocations[param.name];
        if (!location) continue;
        if (param.type === "float") gl.uniform1f(location, value);
        if (param.type === "int" || param.type === "enum") {
          gl.uniform1i(location, value);
        }
        if (param.type === "bool") gl.uniform1i(location, value ? 1 : 0);
        if (param.type === "vec2") gl.uniform2fv(location, value);
        if (param.type === "vec3") gl.uniform3fv(location, value);
        if (param.type === "vec4") gl.uniform4fv(location, value);
        if (param.type === "color") gl.uniform3fv(location, value);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      frames += 1;
      if (now - fpsLast > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsLast)));
        frames = 0;
        fpsLast = now;
      }

      animationId = requestAnimationFrame(render);
    }

    animationId = requestAnimationFrame(render);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, [shader]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} />
      {debug && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "6px 8px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: 4,
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          <div>FPS: {info.fps}</div>
          {info.compileTimeMs !== null && (
            <div>Compile: {info.compileTimeMs} ms</div>
          )}
          {info.error && <div>Error: {info.error}</div>}
        </div>
      )}
    </div>
  );
}
