import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export interface EntityRecord {
  readonly id: string;
  readonly mesh: THREE.Mesh;
  readonly body: RAPIER.RigidBody;
  /** Previous fixed-step pose, used only for presentation interpolation. */
  readonly previousPosition: THREE.Vector3;
  readonly previousRotation: THREE.Quaternion;
}

export interface AnimationSettings {
  spawnInterval: number;
  maxObjects: number;
  autoSpawn: boolean;
}

/** Sole owner of persistent application state and native world/visual handles. */
export class AnimationStore {
  readonly entities = new Map<string, EntityRecord>();
  readonly settings: AnimationSettings = { spawnInterval: 1, maxObjects: 80, autoSpawn: true };
  readonly commands = { spawnRequests: 4, clearRequested: false };
  readonly world: RAPIER.World;
  elapsedSinceSpawn = 0;
  nextEntityId = 0;
  nextVisualKind = 0;

  constructor(world: RAPIER.World) { this.world = world; }
  get objectCount(): number { return this.entities.size; }
  register(record: EntityRecord): void {
    if (this.entities.has(record.id)) throw new Error(`Duplicate entity ID: ${record.id}`);
    this.entities.set(record.id, record);
  }
  unregister(id: string): EntityRecord | undefined {
    const record = this.entities.get(id);
    this.entities.delete(id);
    return record;
  }
  enqueueSpawn(count = 1): void {
    this.commands.spawnRequests = Math.min(200, this.commands.spawnRequests + Math.max(0, Math.floor(count)));
  }
}
