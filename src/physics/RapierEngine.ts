import RAPIER from '@dimforge/rapier3d-compat';
import type { BodySpec, Transform } from './types';

/** Stateless adapter: no world, bodies, registry or Three.js resources retained. */
export class RapierEngine {
  static async initialize(): Promise<RapierEngine> {
    await RAPIER.init();
    return new RapierEngine();
  }

  createWorld(gravity = { x: 0, y: -9.81, z: 0 }, timestep = 1 / 60): RAPIER.World {
    const world = new RAPIER.World(gravity);
    world.timestep = timestep;
    return world;
  }

  createBody(world: RAPIER.World, spec: BodySpec): RAPIER.RigidBody {
    const description = spec.kind === 'fixed'
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic();
    description.setTranslation(spec.position.x, spec.position.y, spec.position.z);
    const body = world.createRigidBody(description);
    const collider = spec.shape === 'sphere'
      ? RAPIER.ColliderDesc.ball(spec.radius ?? 0.5)
      : RAPIER.ColliderDesc.cuboid(
          spec.halfExtents?.x ?? 0.5,
          spec.halfExtents?.y ?? 0.5,
          spec.halfExtents?.z ?? 0.5,
        );
    collider.setRestitution(spec.restitution ?? 0.5);
    collider.setFriction(spec.friction ?? 0.65);
    world.createCollider(collider, body);
    return body;
  }

  step(world: RAPIER.World): void { world.step(); }
  removeBody(world: RAPIER.World, body: RAPIER.RigidBody): void { world.removeRigidBody(body); }

  transform(body: RAPIER.RigidBody): Transform {
    const position = body.translation();
    const rotation = body.rotation();
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    };
  }

  disposeWorld(world: RAPIER.World): void { world.free(); }
}
