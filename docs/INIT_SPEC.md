# sh8r v2 specification

This document defines the target system, decisions, and scope for the new
sh8r website. It will replace the current sh8r prototype once complete.

## Summary

sh8r is a live VideoJockey website/tool where users submit configurable shader
files. The system provides three views:
- **Submit shader**: upload or paste a shader manifest (JSON + GLSL).
- **VJ view**: dynamic controls generated from shader parameters.
- **Live view**: fullscreen shader output for viewers.

The VJ changes parameters in real time and the live view updates immediately
via WebSockets. There is only one global live view and one VJ session.

## Scope

### In scope (v2)
- Shader submission via manifest upload and/or text entry.
- Persisted shader library with VJ selectable dropdown.
- Dynamic VJ controls based on parameter metadata.
- Presets (save/load parameter snapshots per shader).
- WebSocket-based realtime updates (server authoritative).
- BPM/beat sync variables exposed to shaders.
- Basic debug view for development (FPS, compile errors, uniforms).
- Mobile-ready VJ view layout for common controls.

### Out of scope (v2)
- Rooms or multi-tenant instances.
- Auth in app (handled at proxy).
- AI shader generation (future extension point only).
- Moderation or sandboxing beyond basic guidelines.
- MIDI / OSC input.
- Playlists, transitions, or recording/export.

## System architecture (decision)

### Backend
- **Platform**: Node.js (preferred over FastAPI).
- **Realtime**: WebSocket server (single global channel).
- **API**: JSON REST for shaders and presets.
- **Storage**: Postgres preferred; SQLite acceptable for initial dev.
- **Authoritative state**: Server owns current shader selection and param state.

### Frontend
- **Rendering**: WebGL shader rendering (Three.js or raw WebGL).
- **Live view**: fullscreen render only, no UI.
- **VJ view**: control UI generated from manifest param metadata.
- **Submit view**: file upload + text area.
- **Debug view**: optional diagnostics for creator use.

## Shader manifest format

The primary submission format is JSON with embedded GLSL.
Raw GLSL is allowed but treated as unstructured with only default uniforms.

### Manifest schema (v1)
```json
{
  "meta": {
    "title": "Example",
    "author": "sh8",
    "description": "One sentence",
    "tags": ["abstract", "noisy"]
  },
  "params": [
    {
      "name": "speed",
      "type": "float",
      "default": 1.0,
      "min": 0.0,
      "max": 4.0,
      "step": 0.01,
      "label": "Speed"
    },
    {
      "name": "palette",
      "type": "enum",
      "default": "warm",
      "values": ["warm", "cold", "mono"]
    },
    {
      "name": "tint",
      "type": "color",
      "default": "#ff00aa"
    }
  ],
  "shader": {
    "language": "glsl",
    "entry": "shader",
    "code": "vec3 shader(vec2 uv, float time) { return vec3(uv, 0.0); }"
  }
}
```

### Rules
- `meta.title` required; other meta fields optional.
- `params[].name` must be unique and valid GLSL identifier.
- `shader.entry` must be `shader` in v2.
- Shaders are immutable once stored; delete is allowed.
- On submit, server persists manifest and assigns internal `shader_id`.

### Raw GLSL fallback
- Accept raw GLSL string only.
- Parameters are limited to built-in uniforms (see below).
- No dynamic VJ controls are generated.

## Parameter types and UI mapping

Supported parameter types in v2:
- `float`: slider with min/max/step.
- `int`: slider with min/max/step.
- `bool`: toggle.
- `enum`: select dropdown.
- `vec2`: two sliders or 2D pad (UI hint).
- `vec3`: three sliders.
- `vec4`: four sliders.
- `color`: color picker mapped to `vec3` (RGB 0..1).

Optional UI hints:
- `label` (display name)
- `group` (collapsible section)
- `ui` (`slider`, `knob`, `pad`, `color`, etc.)
- `unit` (e.g., `hz`, `bpm`, `%`)

## Uniform mapping

### Built-in uniforms
- `time` (float, seconds)
- `resolution` (vec2, pixels)
- `bpm` (float)
- `beat` (float, 0..1 phase per beat)
- `bar` (float, 0..1 phase per bar)

### Parameter uniforms
Each param becomes a uniform with the same name and GLSL type:
- `float` -> `float`
- `int` -> `int`
- `bool` -> `bool`
- `enum` -> `int` (index in `values`)
- `vec2` -> `vec2`
- `vec3` -> `vec3`
- `vec4` -> `vec4`
- `color` -> `vec3`

If the renderer uses a higher-level shader wrapper, it must inject the
parameter uniforms and the built-in uniforms consistently.

## Realtime behavior

### WebSocket model (server authoritative)
- VJ client sends param changes to server.
- Server validates, updates authoritative state, and broadcasts to all clients.
- Live view subscribes and applies updates.
- Full state sync on client connect, followed by incremental patches.

### Event types
- `state:init`: full state (shader_id + all params + bpm).
- `state:patch`: partial update (only changed values).
- `shader:set`: change current shader by id.
- `preset:load`: set shader + param values.
- `bpm:set`: update bpm (affects `beat` and `bar`).

## Presets

Presets are snapshots of:
- `shader_id`
- all parameter values
- optional name + tags

Presets are persisted and selectable in the VJ view.

## Views

### Submit shader
- Upload JSON file or paste manifest text.
- Basic validation with clear error output.
- Submit creates a new immutable shader entry.

### VJ view
- Shader dropdown (all submitted shaders).
- Generated controls for current shader params.
- Preset save/load list.
- BPM control.
- Mobile layout: grid with collapsible groups.

### Live view
- Fullscreen render only.
- No UI beyond optional debug overlay for development.

### Debug view
- FPS and compile time.
- Current shader name and uniforms.
- Live WebSocket status.

## Persistence model

### Shader
- `id`
- `created_at`
- `manifest` (JSON)
- `code` (GLSL string)
- `meta` (extracted fields for search)

### Preset
- `id`
- `created_at`
- `name`
- `shader_id`
- `params` (JSON map)

## Shader authoring guidelines (best practice)

These are guidance-only in v2:
- Keep functions short and avoid complex loops.
- Favor smooth, continuous output to avoid flicker.
- Clamp or normalize internal values to 0..1 where possible.
- Use the provided uniforms rather than global constants.
- Avoid heavy branching per pixel.

## Future extensions (not implemented)

- AI generation flow (prompt -> manifest).
- Transitions between shaders or presets.
- MIDI/OSC control mapping.
- Multiple VJs with conflict resolution.
- Rooms and multi-tenant instances.

## Implementation notes

- Build with a single global state object on the server.
- Ensure shader compilation failures do not crash the live view.
- Store shader manifests verbatim and treat them as immutable.
- Provide a simple migration path if a schema v2 is introduced later.
