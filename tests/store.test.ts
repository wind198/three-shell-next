import { describe, expect, it } from 'vitest';
import { AnimationStore } from '../src/animation-store/AnimationStore';

describe('AnimationStore', () => {
  it('owns queued commands and clamps requested spawns', () => {
    const store = new AnimationStore({} as ConstructorParameters<typeof AnimationStore>[0]);
    store.enqueueSpawn(500);
    expect(store.commands.spawnRequests).toBe(200);
    store.commands.clearRequested = true;
    expect(store.commands.clearRequested).toBe(true);
  });
  it('detects duplicate entity registrations', () => {
    const store = new AnimationStore({} as ConstructorParameters<typeof AnimationStore>[0]);
    const record = { id: 'a' } as Parameters<typeof store.register>[0];
    store.register(record);
    expect(() => store.register(record)).toThrow('Duplicate entity ID');
    expect(store.unregister('a')).toBe(record);
    expect(store.objectCount).toBe(0);
  });
});
