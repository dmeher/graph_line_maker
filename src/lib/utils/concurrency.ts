export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown = null;
  const workerCount = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));

  async function runNext() {
    while (firstError === null && nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (error) {
        firstError = error;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runNext));
  if (firstError !== null) throw firstError;
  return results;
}
