import {
  filterByGenerations,
  generationFromPokedexId,
  type Generation,
  type Pokemon,
  type PokemonType,
} from "@poke-auction/shared";
import fallbackJson from "./data/fallback-pokemon.json";

const FALLBACK = fallbackJson as Pokemon[];
const GRAPHQL_URL = "https://beta.pokeapi.co/graphql/v1beta";
const REST_URL = "https://pokeapi.co/api/v2";

export type CatalogSource = "pokeapi" | "fallback";

export type CatalogRecord = {
  pokemon: Pokemon[];
  source: CatalogSource;
};

const POKEMON_TYPES = new Set<string>([
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
]);

function asType(name: string): PokemonType | null {
  return POKEMON_TYPES.has(name) ? (name as PokemonType) : null;
}

function spriteUrl(id: number, explicit?: string | null): string {
  return (
    explicit ??
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
  );
}

export function fallbackCatalog(): Pokemon[] {
  return FALLBACK;
}

async function fetchViaGraphql(): Promise<Pokemon[]> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query Catalog {
        pokemon_v2_pokemon(where: {id: {_lte: 1025}, is_default: {_eq: true}}) {
          id
          name
          pokemon_v2_pokemonspecy { generation_id }
          pokemon_v2_pokemontypes(order_by: {slot: asc}) {
            pokemon_v2_type { name }
          }
          pokemon_v2_pokemonstats { base_stat }
        }
      }`,
    }),
  });
  if (!res.ok) throw new Error(`PokeAPI GraphQL ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      pokemon_v2_pokemon: Array<{
        id: number;
        name: string;
        pokemon_v2_pokemonspecy: { generation_id: number } | null;
        pokemon_v2_pokemontypes: Array<{ pokemon_v2_type: { name: string } }>;
        pokemon_v2_pokemonstats: Array<{ base_stat: number }>;
      }>;
    };
  };
  const rows = body.data?.pokemon_v2_pokemon;
  if (!rows || rows.length < 50) throw new Error("PokeAPI GraphQL returned too little data");

  const catalog: Pokemon[] = [];
  for (const row of rows) {
    const generation = (row.pokemon_v2_pokemonspecy?.generation_id ??
      generationFromPokedexId(row.id)) as Generation | null;
    if (!generation || generation < 1 || generation > 9) continue;
    const types = row.pokemon_v2_pokemontypes
      .map((entry) => asType(entry.pokemon_v2_type.name))
      .filter((type): type is PokemonType => type !== null);
    if (types.length === 0) continue;
    catalog.push({
      id: row.id,
      name: row.name,
      generation,
      types,
      spriteUrl: spriteUrl(row.id),
      baseStatTotal: row.pokemon_v2_pokemonstats.reduce(
        (sum, stat) => sum + stat.base_stat,
        0,
      ),
    });
  }
  if (catalog.length < 50) throw new Error("PokeAPI GraphQL catalog unusable");
  return catalog;
}

async function fetchViaRest(generations: readonly Generation[]): Promise<Pokemon[]> {
  const ids = new Set<number>();
  for (const generation of generations) {
    const res = await fetch(`${REST_URL}/generation/${generation}/`);
    if (!res.ok) continue;
    const data = (await res.json()) as {
      pokemon_species: Array<{ url: string }>;
    };
    for (const species of data.pokemon_species) {
      const match = species.url.match(/\/pokemon-species\/(\d+)\/?$/);
      if (match) ids.add(Number(match[1]));
    }
  }

  const budget = Math.max(0, 45 - generations.length);
  const toFetch = [...ids].sort((a, b) => a - b).slice(0, budget);
  const settled = await Promise.allSettled(
    toFetch.map(async (id) => {
      const res = await fetch(`${REST_URL}/pokemon/${id}/`);
      if (!res.ok) throw new Error(String(res.status));
      const pokemon = (await res.json()) as {
        id: number;
        name: string;
        types: Array<{ slot: number; type: { name: string } }>;
        stats: Array<{ base_stat: number }>;
        sprites: {
          front_default: string | null;
          other?: { "official-artwork"?: { front_default: string | null } };
        };
      };
      const generation = generationFromPokedexId(pokemon.id);
      if (!generation) throw new Error("unknown generation");
      const types = [...pokemon.types]
        .sort((a, b) => a.slot - b.slot)
        .map((entry) => asType(entry.type.name))
        .filter((type): type is PokemonType => type !== null);
      return {
        id: pokemon.id,
        name: pokemon.name,
        generation,
        types,
        spriteUrl: spriteUrl(
          pokemon.id,
          pokemon.sprites.other?.["official-artwork"]?.front_default ??
            pokemon.sprites.front_default,
        ),
        baseStatTotal: pokemon.stats.reduce((sum, stat) => sum + stat.base_stat, 0),
      } satisfies Pokemon;
    }),
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

function mergeById(...lists: Pokemon[][]): Pokemon[] {
  const map = new Map<number, Pokemon>();
  for (const list of lists) {
    for (const pokemon of list) map.set(pokemon.id, pokemon);
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export async function loadCatalog(
  generations: readonly Generation[],
  cached: CatalogRecord | null,
): Promise<CatalogRecord> {
  if (cached?.source === "pokeapi" && cached.pokemon.length > 0) {
    return cached;
  }

  try {
    const pokemon = await fetchViaGraphql();
    return { pokemon, source: "pokeapi" };
  } catch {
    try {
      const rest = await fetchViaRest(generations);
      const pokemon = mergeById(FALLBACK, rest);
      const usable = filterByGenerations(pokemon, generations);
      if (usable.length === 0) return { pokemon: FALLBACK, source: "fallback" };
      return {
        pokemon,
        source: rest.length > 0 ? "pokeapi" : "fallback",
      };
    } catch {
      return { pokemon: FALLBACK, source: "fallback" };
    }
  }
}
