# AGENTS.md

This file provides guidance for AI agents working in this directory.

## Security restrictions

**CRITICAL**:
- Do not access secrets, keys, or passwords.
- Do not execute commands on remote servers.
- Git is read-only (no commits, pushes, or PRs).
- Do not access files owned by root or with restricted permissions.

## Project overview

sh8r is a live VideoJockey tool for submitting and performing GLSL shaders.
It includes a Fastify backend with WebSocket state and a React/Vite frontend.

## Conventions

- Keep files under 500 LOC when possible.
- No emojis in logging, comments, or code.
- Prefer small, explicit modules over large monoliths.
