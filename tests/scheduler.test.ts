import { describe, expect, it } from 'vitest';
import { SimulationRuntime, type TickContext } from '../src/core/scheduler';

interface Context extends TickContext { events: string[] }
function setup() {
  const context: Context = { dt: 0, frameDelta: 0, frameId: 0, simulationTick: 0, alpha: 0, events: [] };
  const runtime = new SimulationRuntime(context, {
    fixedDelta: 0.02,
    maxFrameDelta: 0.1,
    maxStepsPerFrame: 3,
    simulation: (ctx) => ctx.events.push(`sim:${ctx.simulationTick}`),
    presentation: (ctx) => ctx.events.push(`present:${ctx.frameId}`),
  });
  return { context, runtime };
}

describe('simulation scheduler', () => {
  it('executes fixed simulation steps before one presentation', () => {
    const { context, runtime } = setup();
    runtime.start();
    runtime.tick(0);
    runtime.tick(50);
    expect(context.events).toEqual(['present:1', 'sim:1', 'sim:2', 'present:2']);
    expect(context.alpha).toBeCloseTo(0.5);
  });

  it('limits catch-up work after a slow frame', () => {
    const { context, runtime } = setup();
    runtime.start();
    runtime.tick(0);
    runtime.tick(2000);
    expect(context.simulationTick).toBe(3);
  });

  it('pauses simulation but keeps presentation active and resumes without time jumps', () => {
    const { context, runtime } = setup();
    runtime.start();
    runtime.tick(0);
    runtime.pause();
    runtime.tick(5000);
    expect(context.simulationTick).toBe(0);
    expect(context.frameId).toBe(2);
    expect(context.alpha).toBe(1);
    runtime.resume();
    runtime.tick(9000);
    expect(context.simulationTick).toBe(0);
    runtime.tick(9020);
    expect(context.simulationTick).toBe(1);
  });

  it('fails fast and stops after a stage throws', () => {
    const { context } = setup();
    const runtime = new SimulationRuntime(context, {
      fixedDelta: 0.02,
      simulation: () => { throw new Error('broken'); },
      presentation: () => {},
    });
    runtime.start();
    runtime.tick(0);
    expect(() => runtime.tick(20)).toThrow('broken');
    expect(runtime.isRunning).toBe(false);
  });
});
