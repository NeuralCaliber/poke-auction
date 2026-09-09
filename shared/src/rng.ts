export interface Rng {
  int(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state;
  };

  return {
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return next() % maxExclusive;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = next() % (i + 1);
        const a = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = a;
      }
      return copy;
    },
  };
}

export const mathRng: Rng = {
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(Math.random() * maxExclusive);
  },
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = a;
    }
    return copy;
  },
};
