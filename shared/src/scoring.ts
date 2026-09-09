import { SCORING } from "./constants.ts";
import type {
  Holding,
  MatchResult,
  Player,
  Pokemon,
  ScoreBreakdown,
} from "./types.ts";

export function scoreRoster(
  holdings: readonly Holding[],
  remainingBudget: number,
): ScoreBreakdown {
  const dollarsSpent = holdings.reduce((sum, h) => sum + h.cost, 0);
  const base = holdings.reduce((sum, h) => sum + h.pokemon.baseStatTotal, 0);

  const types = new Set<string>();
  const generations = new Set<number>();
  for (const holding of holdings) {
    for (const type of holding.pokemon.types) types.add(type);
    generations.add(holding.pokemon.generation);
  }

  const coverage = types.size * SCORING.coveragePerDistinctType;
  const spread = generations.size * SCORING.spreadPerDistinctGeneration;
  const frugality = remainingBudget * SCORING.frugalityPerUnspentDollar;

  return {
    base,
    coverage,
    spread,
    frugality,
    total: base + coverage + spread + frugality,
    dollarsSpent,
  };
}

export function compareResults(a: MatchResult, b: MatchResult): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;
  if (a.score.dollarsSpent !== b.score.dollarsSpent) {
    return a.score.dollarsSpent - b.score.dollarsSpent;
  }
  return a.playerId.localeCompare(b.playerId);
}

export function buildMatchResults(
  players: readonly Player[],
  rosters: Record<string, Holding[]>,
): MatchResult[] {
  const unsorted: MatchResult[] = players.map((player) => {
    const holdings = rosters[player.id] ?? [];
    return {
      playerId: player.id,
      name: player.name,
      color: player.color,
      holdings: holdings.map((h) => ({
        lotId: h.lotId,
        pokemon: h.pokemon,
        cost: h.cost,
      })),
      remainingBudget: player.budget,
      score: scoreRoster(holdings, player.budget),
      placement: 0,
      isWinner: false,
    };
  });

  unsorted.sort(compareResults);

  return unsorted.map((result, index) => ({
    ...result,
    placement: index + 1,
    isWinner: index === 0,
  }));
}

export function pokemonIdentityFields(pokemon: Pokemon): {
  id: number;
  name: string;
  spriteUrl: string;
  baseStatTotal: number;
} {
  return {
    id: pokemon.id,
    name: pokemon.name,
    spriteUrl: pokemon.spriteUrl,
    baseStatTotal: pokemon.baseStatTotal,
  };
}
