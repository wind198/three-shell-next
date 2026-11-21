import { ThreeShell, type SimulationController, type SimulationMetrics } from './ThreeShell';
export type { SimulationController, SimulationMetrics };
export async function mountSimulation(
  container: HTMLElement,
  onMetrics: (metrics: SimulationMetrics) => void,
): Promise<SimulationController> {
  return ThreeShell.mount(container, onMetrics);
}
