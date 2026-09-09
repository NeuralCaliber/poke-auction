import type { Generation } from "./constants.ts";
import type { MatchSettings, Pokemon, PoolScarcity } from "./types.ts";
import type { Rng } from "./rng.ts";

const GEN_RANGES: { gen: Generation; min: number; max: number }[] = [
  { gen: 1, min: 1, max: 151 },
  { gen: 2, min: 152, max: 251 },
  { gen: 3, min: 252, max: 386 },
  { gen: 4, min: 387, max: 493 },
  { gen: 5, min: 494, max: 649 },
  { gen: 6, min: 650, max: 721 },
  { gen: 7, min: 722, max: 809 },
  { gen: 8, min: 810, max: 905 },
  { gen: 9, min: 906, max: 1025 },
];

export function generationFromPokedexId(id: number): Generation | null {
  for (const range of GEN_RANGES) {
    if (id >= range.min && id <= range.max) return range.gen;
  }
  return null;
}

export function computePoolSize(
  playerCount: number,
  rosterSize: number,
  scarcity: PoolScarcity,
): number {
  const exact = playerCount * rosterSize;
  if (scarcity === "exact") return exact;
  return Math.max(playerCount * 2, Math.floor(exact * 0.8));
}

export function filterByGenerations(
  catalog: readonly Pokemon[],
  generations: readonly Generation[],
): Pokemon[] {
  const allowed = new Set(generations);
  return catalog.filter((p) => allowed.has(p.generation));
}

export function selectPool(
  catalog: readonly Pokemon[],
  playerCount: number,
  settings: MatchSettings,
  rng: Rng,
): Pokemon[] {
  const filtered = filterByGenerations(catalog, settings.generations);
  const size = Math.min(
    computePoolSize(playerCount, settings.rosterSize, settings.poolScarcity),
    filtered.length,
  );
  return rng.shuffle(filtered).slice(0, size);
}
