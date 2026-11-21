import type { Operator } from './pipe';

/** The host's renderer calls tick(timestampMs) once per display frame. */
export interface TickContext {
  /** Fixed-step duration, in seconds when used by simulation operators. */
  dt: number;
  /** Seconds elapsed in the current render frame, clamped to maxFrameDelta. */
  frameDelta: number;
  /** Fixed steps executed since startup. */
  simulationTick: number;
  /** Current render frame counter. */
  frameId: number;
  /** Presentation interpolation between previous and current simulation pose. */
  alpha: number;
}

export interface SimulationSpec<T extends TickContext> {
  simulation: Operator<T>;
  presentation: Operator<T>;
  fixedDelta?: number;
  maxFrameDelta?: number;
  maxStepsPerFrame?: number;
}

/** Single clock / fixed-step accumulator. No browser or Three.js dependencies. */
export class SimulationRuntime<T extends TickContext> {
  private previousTimestamp: number | null = null;
  private accumulator = 0;
  private running = false;
  private paused = false;
  private ticking = false;
  private readonly fixedDelta: number;
  private readonly maxFrameDelta: number;
  private readonly maxSteps: number;

  constructor(private readonly context: T, private readonly spec: SimulationSpec<T>) {
    this.fixedDelta = spec.fixedDelta ?? 1 / 60;
    this.maxFrameDelta = spec.maxFrameDelta ?? 0.1;
    this.maxSteps = spec.maxStepsPerFrame ?? 5;
    if (!(this.fixedDelta > 0) || !(this.maxFrameDelta > 0) || !Number.isInteger(this.maxSteps) || this.maxSteps < 1) {
      throw new Error('Invalid simulation timing configuration');
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  stop(): void {
    this.running = false;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  pause(): void {
    this.paused = true;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  resume(): void {
    this.paused = false;
    this.previousTimestamp = null;
  }

  get isPaused(): boolean { return this.paused; }
  get isRunning(): boolean { return this.running; }

  tick(timestampMs: number): void {
    if (!this.running) return;
    if (this.ticking) throw new Error('Reentrant simulation frame');
    if (!Number.isFinite(timestampMs)) throw new Error('Invalid frame timestamp');
    this.ticking = true;
    try {
      const elapsed = this.previousTimestamp === null ? 0 : Math.max(0, (timestampMs - this.previousTimestamp) / 1000);
      this.previousTimestamp = timestampMs;
      const frameDelta = Math.min(elapsed, this.maxFrameDelta);
      const ctx = this.context;
      ctx.frameId++;
      ctx.frameDelta = frameDelta;
      if (!this.paused) {
        this.accumulator += frameDelta;
        let steps = 0;
        // Epsilon prevents missed steps due to floating-point rounding.
        while (this.accumulator + 1e-10 >= this.fixedDelta && steps < this.maxSteps) {
          ctx.dt = this.fixedDelta;
          ctx.simulationTick++;
          this.spec.simulation(ctx);
          this.accumulator = Math.max(0, this.accumulator - this.fixedDelta);
          steps++;
        }
        // Explicit drop policy on slow frames; avoid an infinite catch-up spiral.
        if (steps === this.maxSteps && this.accumulator >= this.fixedDelta) {
          this.accumulator %= this.fixedDelta;
        }
      }
      ctx.alpha = this.paused ? 1 : Math.min(1, this.accumulator / this.fixedDelta);
      this.spec.presentation(ctx);
    } catch (error) {
      this.stop();
      throw error;
    } finally {
      this.ticking = false;
    }
  }
}
