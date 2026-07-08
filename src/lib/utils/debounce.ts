export function createDebouncedAction<TArgs extends unknown[]>(callback: (...args: TArgs) => void, delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    run: (...args: TArgs) => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      timeoutId = globalThis.setTimeout(() => {
        timeoutId = null;
        callback(...args);
      }, delayMs);
    },
    cancel: () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
