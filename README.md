# ThreeShell — Next.js + Three.js + Rapier

A **Level 2 / system-responsibility** code-first animation pipeline implemented as methods of `ThreeShell`. Built on the Next.js App Router, TypeScript, Three.js and Rapier.

## Start

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

| Module | Owns | Does not own |
|---|---|---|
| `three-shell/ThreeShell.ts` | Pipeline composition, scheduler integration, lifecycle, scene coordination, object spawning and rendering | Persistent physics world ownership |
| `animation-store/AnimationStore.ts` | Entity registry, native physics world reference, settings and queued commands | Frame orchestration or native physics algorithms |
| `physics/RapierEngine.ts` | Stateless physics API: create world/body, step, remove and read transforms | Three.js imports, meshes, materials, registries, retained world state |
| `three-shell/SceneFactory.ts` | Three.js environment and visual resource construction | Physics or application workflows |
| `core/` | Synchronous `pipe()` and fixed-step clock | Domain behavior |

The system-level pipelines are defined **inside the `ThreeShell` constructor**, and their steps are **ordinary private instance methods**:

```ts
simulation: pipe(
  (frame) => this.spawnObjects(frame),
  (frame) => this.simulatePhysics(frame),
  (frame) => this.removeFallenObjects(frame),
),
presentation: pipe(
  (frame) => this.synchronizeScene(frame),
  (frame) => this.updateCamera(frame),
  (frame) => this.renderFrame(frame),
),
```

The engine does not use operator configuration records or dependency graph sorting. Method wrappers are created once, not per frame. The render loop is registered once with `WebGLRenderer.setAnimationLoop`.

### Ownership and time

- Rapier's `World` is **inherently mutable**. `RapierEngine` has no persistent internal state; the store retains the world handle and entity/body registry. Rapier remains authoritative for simulated transforms.
- `ThreeShell` is the only coordinator allowed to mutate both the visual and physical representations of an entity.
- One entity is a mesh/body association, and the store holds the association. Static ground is represented in both systems during startup.
- Simulation advances at a fixed `1/60 s` with a capped accumulator. Scene interpolation and rendering execute once per display frame.
- UI commands enqueue changes for the next eligible fixed simulation step, not immediately in an arbitrary React callback. When paused, queued commands are handled upon resume.
- All shared geometries and materials are disposed by the Three.js resources owner; individual object cleanup only removes meshes/bodies.

### Browser / Next.js integration

The React client component dynamically imports `three-shell/bootstrap.ts` from `useEffect`. Three.js/Rapier are never initialized during server rendering. React owns UI and shell mounting, not per-frame object transforms. The effect cleanup disposes the shell and renderer.

## Project layout

```text
src/
  app/                       # Next.js App Router
  components/                # React UI
  three-shell/
    ThreeShell.ts            # Orchestration + named method pipeline
    SceneFactory.ts          # Three.js-only resources
    bootstrap.ts             # Browser mounting API
  animation-store/
    AnimationStore.ts        # Stateful registry + physics world handle
  physics/
    RapierEngine.ts          # Stateless Rapier API
    types.ts                 # Engine-independent body DTOs
  core/
    pipe.ts                  # Simple ordered composition
    scheduler.ts             # Fixed-step scheduling and lifecycle
tests/
  pipe.test.ts
  scheduler.test.ts
```

## Known constraints

- This is a focused demo, not a general scene ECS or full physics abstraction.
- The stateless adapter still operates on a *mutable* Rapier world; it is not a pure function.
- Runtime dependencies and the browser preview should be verified locally with the commands above.
