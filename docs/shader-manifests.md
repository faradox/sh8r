# Shader manifest guide

This document explains how to author shader manifests for sh8r. Manifests are
JSON files that describe metadata, parameters, and a GLSL shader entry.

## Overview

A manifest has three top-level keys:

- `meta`: title and optional metadata.
- `params`: an array of parameter definitions used to build the VJ controls.
- `shader`: the GLSL shader entry and code.

## Minimal manifest

```json
{
  "meta": {
    "title": "My Shader"
  },
  "params": [],
  "shader": {
    "language": "glsl",
    "entry": "shader",
    "code": "vec3 shader(vec2 uv, float time) { return vec3(uv, 0.0); }"
  }
}
```

## Required rules

- `meta.title` is required.
- `shader.entry` must be `"shader"`.
- `params[].name` must be unique and a valid GLSL identifier.
- `params[].name` must not shadow a built-in (`time`, `resolution`, `bpm`,
  `beat`, `bar`, `shader`, `main`, or anything starting with `gl_`).
- `params[].type` must be one of the types below; `enum` needs `values`.
- The shader function must be named `shader`, with the signature
  `vec3 shader(vec2 uv, float time)`. `uv` is 0..1 across the canvas.

## Parameter types

Each parameter is exposed to GLSL as a uniform with the same name.

| type   | GLSL uniform | UI control |
|--------|--------------|------------|
| float  | float        | slider     |
| int    | int          | slider     |
| bool   | bool         | toggle     |
| enum   | int          | dropdown   |
| vec2   | vec2         | 2 sliders  |
| vec3   | vec3         | 3 sliders  |
| vec4   | vec4         | 4 sliders  |
| color  | vec3         | color picker (RGB 0..1) |

### Common parameter fields

- `name` (required): uniform name used in GLSL.
- `type` (required): one of the types above.
- `default`: initial value.
- `min`, `max`, `step`: slider bounds for numeric types.
- `label`: display label in the UI.
- `values`: list of options for `enum`.
- `group`: optional grouping label for UI sections.
- `ui`: optional UI hint (`slider`, `knob`, `pad`, `color`, etc.).
- `unit`: optional unit label (`hz`, `bpm`, `%`, etc.).

## Built-in uniforms

These uniforms are always available:

- `time` (float): seconds since start.
- `resolution` (vec2): viewport size in pixels.
- `bpm` (float): current BPM value.
- `beat` (float): 0..1 phase per beat.
- `bar` (float): 0..1 phase per bar (4 beats).

`beat` and `bar` follow a server-side clock, so every connected screen pulses
in sync. The VJ sets the tempo by typing it, tapping it (the first tap is
beat 1 of a bar), or pressing "Sync 1" on a downbeat. `time` restarts at 0
whenever the live shader changes.

Param values arriving from the VJ are sanitized by the server: numbers are
clamped to `min`/`max`, `int` values are truncated, and vectors are padded
to their size.

## Example manifest

```json
{
  "meta": {
    "title": "Aurora Pulse",
    "author": "sh8r demo",
    "description": "Soft gradient with beat-synced pulses.",
    "tags": ["demo", "gradient", "beat"]
  },
  "params": [
    {
      "name": "speed",
      "type": "float",
      "default": 1.2,
      "min": 0.0,
      "max": 4.0,
      "step": 0.01,
      "label": "Speed"
    },
    {
      "name": "palette",
      "type": "enum",
      "default": "warm",
      "values": ["warm", "cold", "mono"],
      "label": "Palette"
    },
    {
      "name": "tint",
      "type": "color",
      "default": "#ff3ea5",
      "label": "Tint"
    }
  ],
  "shader": {
    "language": "glsl",
    "entry": "shader",
    "code": "vec3 shader(vec2 uv, float time) { return vec3(uv, 0.0); }"
  }
}
```

## Previewing and errors

The Submit page compiles the shader in the browser as you type and shows a
live preview with working controls. Compiler errors refer to line numbers
within `shader.code` (line 1 is the first line of your code), and submitting
stays disabled until the shader compiles.

## Performance

The renderer adapts its resolution to hold a smooth frame rate: on a slow
GPU a heavy shader renders at a lower internal resolution (down to 35% of
the screen size) and is upscaled. Cheaper shaders therefore look sharper on
weak hardware. Rendering is capped at 1920x1080 pixels by default.

## Validation tips

- Make sure the JSON is valid and all strings are quoted.
- Ensure `params[].name` is a valid identifier: letters, digits, underscore,
  and does not start with a digit.
- Keep shader code compact and avoid heavy loops for better performance.
