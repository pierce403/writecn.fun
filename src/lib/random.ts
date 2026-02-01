export function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

export function sampleDistinct<T>(
  items: readonly T[],
  count: number,
  isAllowed: (item: T) => boolean,
): T[] {
  const allowed = items.filter(isAllowed);
  if (count > allowed.length) {
    throw new Error(`Not enough items to sample: requested ${count}, got ${allowed.length}`);
  }

  const pool = [...allowed];
  shuffleInPlace(pool);
  return pool.slice(0, count);
}

