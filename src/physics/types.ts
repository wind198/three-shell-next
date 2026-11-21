/** Physics DTOs are deliberately independent of Three.js. */
export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
export type BodyShape = 'box' | 'sphere';

export interface BodySpec {
  kind: 'fixed' | 'dynamic';
  shape: BodyShape;
  position: Vec3;
  halfExtents?: Vec3;
  radius?: number;
  restitution?: number;
  friction?: number;
}
export interface Transform { position: Vec3; rotation: Quat }
