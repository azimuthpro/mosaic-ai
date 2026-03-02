/**
 * Hard timeout wrapper using Promise.race.
 * Guarantees no operation exceeds its budget regardless of what hangs internally.
 */

export class TimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly label?: string,
  ) {
    super(
      label
        ? `${label} timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`,
    );
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a hard timeout. If the promise doesn't resolve
 * within `timeoutMs`, it rejects with a `TimeoutError`.
 *
 * Note: The underlying operation is NOT cancelled — this only races
 * the promise against a timer. For fetch-based operations, use
 * AbortController for true cancellation.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(timeoutMs, label)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
