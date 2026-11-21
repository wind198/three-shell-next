/** Code-first, ordered and synchronous composition; no hidden graph or operator metadata. */
export type Operator<T> = (context: T) => void;

export function pipe<T>(...operators: readonly Operator<T>[]): Operator<T> {
  // Resolve sequence once, not on every frame.
  return (context: T): void => {
    for (let i = 0; i < operators.length; i++) operators[i](context);
  };
}
