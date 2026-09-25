export const VERTEX_SOURCE = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const TYPE_TO_GLSL = {
  float: "float",
  int: "int",
  bool: "bool",
  enum: "int",
  vec2: "vec2",
  vec3: "vec3",
  vec4: "vec4",
  color: "vec3",
};

export function glslType(type) {
  return TYPE_TO_GLSL[type] || "float";
}

export function shaderParams(manifest) {
  return Array.isArray(manifest?.params) ? manifest.params : [];
}

// Builds the fragment shader around the user's `vec3 shader(vec2, float)`.
// Returns the offset of the first user code line so compiler errors can be
// reported against the code the author actually wrote.
export function buildFragmentSource(manifest) {
  const uniforms = shaderParams(manifest).map(
    (param) => `uniform ${glslType(param.type)} ${param.name};`
  );
  const prefix = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform float time;",
    "uniform vec2 resolution;",
    "uniform float bpm;",
    "uniform float beat;",
    "uniform float bar;",
    ...uniforms,
  ];
  const suffix = [
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / resolution;",
    "  gl_FragColor = vec4(shader(uv, time), 1.0);",
    "}",
  ];
  const code = manifest?.shader?.code ?? "";
  return {
    source: [...prefix, code, ...suffix].join("\n"),
    lineOffset: prefix.length,
  };
}

// Rewrites "ERROR: 0:42:" style locations to user code line numbers.
export function mapErrorLines(log, lineOffset) {
  return String(log || "")
    .replace(/(ERROR|WARNING): (\d+):(\d+):/g, (match, kind, file, line) => {
      const mapped = Number(line) - lineOffset;
      return mapped > 0 ? `${kind}: line ${mapped}:` : `${kind}: (wrapper):`;
    })
    .replace(/\0/g, "")
    .trim();
}
