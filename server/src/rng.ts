import type { Rng } from "@poke-auction/shared";

export function createCryptoRng(): Rng {
  return {
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return (buf[0] ?? 0) % maxExclusive;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const j = (buf[0] ?? 0) % (i + 1);
        const current = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = current;
      }
      return copy;
    },
  };
}
