import * as THREE from 'three';
import { pipe } from '../core/pipe';
import { SimulationRuntime, type TickContext } from '../core/scheduler';
import { AnimationStore, type EntityRecord } from '../animation-store/AnimationStore';
import { RapierEngine } from '../physics/RapierEngine';
import { createScene, type ThreeSceneResources } from './SceneFactory';

export interface SimulationMetrics { fps: number; objects: number }
export interface SimulationController {
  spawn(): void;
  clear(): void;
  setAutoSpawn(value: boolean): void;
  setSpawnInterval(seconds: number): void;
  pause(): void;
  resume(): void;
  readonly isPaused: boolean;
  dispose(): void;
}

interface Frame extends TickContext {}

/** The sole orchestrator: all system-level pipeline steps are methods of this class. */
export class ThreeShell implements SimulationController {
  private readonly frame: Frame = {
    dt: 0, frameDelta: 0, frameId: 0, simulationTick: 0, alpha: 0,
  };
  private readonly runtime: SimulationRuntime<Frame>;
  private disposed = false;
  private fpsFrames = 0;
  private fpsElapsedMs = 0;
  private lastMetricsTimestamp: number | null = null;

  private constructor(
    private readonly three: ThreeSceneResources,
    private readonly store: AnimationStore,
    private readonly physics: RapierEngine,
    private readonly onMetrics: (metrics: SimulationMetrics) => void,
  ) {
    this.runtime = new SimulationRuntime(this.frame, {
      fixedDelta: 1 / 60,
      maxFrameDelta: 0.1,
      maxStepsPerFrame: 5,
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
    });
  }

  /** Browser-only factory: React mounts once, shell schedules one frame loop. */
  static async mount(container: HTMLElement, onMetrics: (metrics: SimulationMetrics) => void): Promise<ThreeShell> {
    const three = createScene(container);
    try {
      const physics = await RapierEngine.initialize();
      const store = new AnimationStore(physics.createWorld());
      try {
        physics.createBody(store.world, {
          kind: 'fixed', shape: 'box', position: { x: 0, y: -0.25, z: 0 },
          halfExtents: { x: 5, y: 0.25, z: 5 }, restitution: 0, friction: 0.85,
        });
        const shell = new ThreeShell(three, store, physics, onMetrics);
        shell.start();
        return shell;
      } catch (error) {
        physics.disposeWorld(store.world);
        throw error;
      }
    } catch (error) {
      three.dispose();
      throw error;
    }
  }

  private start(): void {
    this.runtime.start();
    this.three.renderer.setAnimationLoop((timestamp) => {
      try {
        this.runtime.tick(timestamp);
        this.reportMetrics(timestamp);
      } catch (error) {
        this.three.renderer.setAnimationLoop(null);
        console.error('ThreeShell frame failed:', error);
        this.onMetrics({ fps: 0, objects: this.store.objectCount });
      }
    });
  }

  private spawnObjects(frame: Frame): void {
    const { commands, settings } = this.store;
    if (commands.clearRequested) {
      this.clearEntities();
      commands.clearRequested = false;
    }
    const pending = Math.min(20, commands.spawnRequests);
    commands.spawnRequests -= pending;
    for (let i = 0; i < pending; i++) this.createObject();
    if (!settings.autoSpawn) {
      this.store.elapsedSinceSpawn = 0;
      return;
    }
    this.store.elapsedSinceSpawn += frame.dt;
    while (this.store.elapsedSinceSpawn >= settings.spawnInterval) {
      this.store.elapsedSinceSpawn -= settings.spawnInterval;
      this.createObject();
    }
  }

  private simulatePhysics(_frame: Frame): void {
    for (const entity of this.store.entities.values()) {
      const transform = this.physics.transform(entity.body);
      entity.previousPosition.set(transform.position.x, transform.position.y, transform.position.z);
      entity.previousRotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    }
    this.physics.step(this.store.world);
  }

  private removeFallenObjects(_frame: Frame): void {
    for (const entity of this.store.entities.values()) {
      if (this.physics.transform(entity.body).position.y < -10) this.removeObject(entity.id);
    }
    while (this.store.objectCount > this.store.settings.maxObjects) {
      const oldest = this.store.entities.keys().next().value;
      if (oldest === undefined) break;
      this.removeObject(oldest);
    }
  }

  private synchronizeScene(frame: Frame): void {
    for (const entity of this.store.entities.values()) {
      const { position, rotation } = this.physics.transform(entity.body);
      const mesh = entity.mesh;
      // Interpolate previous and current physics poses without modifying either state.
      mesh.position.set(position.x, position.y, position.z);
      mesh.position.lerpVectors(entity.previousPosition, mesh.position, frame.alpha);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      mesh.quaternion.slerpQuaternions(entity.previousRotation, mesh.quaternion, frame.alpha);
    }
  }

  private updateCamera(_frame: Frame): void { this.three.controls.update(); }
  private renderFrame(_frame: Frame): void {
    this.three.renderer.render(this.three.scene, this.three.camera);
  }

  private createObject(): void {
    const variant = this.store.nextVisualKind++ % 3;
    const x = (Math.random() - 0.5) * 3.2;
    const y = 6 + Math.random() * 2.5;
    const z = (Math.random() - 0.5) * 3.2;
    const mesh = new THREE.Mesh(
      variant === 1 ? this.three.geometries.sphere : this.three.geometries.box,
      this.three.materials[variant],
    );
    mesh.castShadow = true;
    mesh.position.set(x, y, z);
    const body = this.physics.createBody(this.store.world, {
      kind: 'dynamic', shape: variant === 1 ? 'sphere' : 'box',
      position: { x, y, z }, radius: 0.5, halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      restitution: 0.5, friction: 0.65,
    });
    const id = `body-${this.store.nextEntityId++}`;
    const record: EntityRecord = {
      id, mesh, body,
      previousPosition: mesh.position.clone(),
      previousRotation: mesh.quaternion.clone(),
    };
    try {
      this.store.register(record);
      this.three.scene.add(mesh);
    } catch (error) {
      this.physics.removeBody(this.store.world, body);
      throw error;
    }
  }

  private removeObject(id: string): void {
    const entity = this.store.unregister(id);
    if (!entity) return;
    this.three.scene.remove(entity.mesh);
    this.physics.removeBody(this.store.world, entity.body);
  }
  private clearEntities(): void {
    for (const id of [...this.store.entities.keys()]) this.removeObject(id);
  }

  private reportMetrics(timestamp: number): void {
    this.fpsFrames++;
    if (this.lastMetricsTimestamp !== null) this.fpsElapsedMs += Math.min(Math.max(timestamp - this.lastMetricsTimestamp, 0), 100);
    this.lastMetricsTimestamp = timestamp;
    if (this.fpsElapsedMs >= 500) {
      this.onMetrics({ fps: Math.round(this.fpsFrames * 1000 / this.fpsElapsedMs), objects: this.store.objectCount });
      this.fpsFrames = 0;
      this.fpsElapsedMs = 0;
    }
  }

  spawn(): void { this.store.enqueueSpawn(); }
  clear(): void { this.store.commands.clearRequested = true; }
  setAutoSpawn(value: boolean): void { this.store.settings.autoSpawn = value; }
  setSpawnInterval(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Spawn interval must be positive');
    this.store.settings.spawnInterval = seconds;
  }
  pause(): void { this.runtime.pause(); }
  resume(): void { this.runtime.resume(); }
  get isPaused(): boolean { return this.runtime.isPaused; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.stop();
    this.three.renderer.setAnimationLoop(null);
    this.clearEntities();
    this.physics.disposeWorld(this.store.world);
    this.three.dispose();
  }
}
