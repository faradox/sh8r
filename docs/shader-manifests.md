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
- The shader function must be named `shader`.

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
- `bar` (float): 0..1 phase per bar.

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

## Validation tips

- Make sure the JSON is valid and all strings are quoted.
- Ensure `params[].name` is a valid identifier: letters, digits, underscore,
  and does not start with a digit.
- Keep shader code compact and avoid heavy loops for better performance.
