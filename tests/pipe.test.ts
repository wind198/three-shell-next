import { describe, expect, it } from 'vitest';
import { pipe } from '../src/core/pipe';

describe('pipe', () => {
  it('executes operators in their declared order with the same context', () => {
    const context = { value: 0, calls: [] as string[] };
    const execute = pipe<typeof context>(
      (ctx) => { ctx.value += 1; ctx.calls.push('first'); },
      (ctx) => { ctx.value *= 5; ctx.calls.push('second'); },
      (ctx) => { ctx.value -= 2; ctx.calls.push('third'); },
    );
    execute(context);
    expect(context.value).toBe(8);
    expect(context.calls).toEqual(['first', 'second', 'third']);
  });

  it('does not swallow operator errors', () => {
    const execute = pipe<{ calls: string[] }>(
      (ctx) => ctx.calls.push('first'),
      () => { throw new Error('stage failed'); },
      (ctx) => ctx.calls.push('never'),
    );
    const ctx = { calls: [] as string[] };
    expect(() => execute(ctx)).toThrow('stage failed');
    expect(ctx.calls).toEqual(['first']);
  });
});
