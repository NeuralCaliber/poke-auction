const OUT = new URL("../src/data/fallback-pokemon.json", import.meta.url);

async function fetchOne(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`pokemon ${id}: ${res.status}`);
  const p = await res.json();
  const artwork =
    p.sprites?.other?.["official-artwork"]?.front_default ??
    p.sprites?.front_default ??
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  return {
    id: p.id,
    name: p.name,
    generation: 1,
    types: [...p.types]
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name),
    spriteUrl: artwork,
    baseStatTotal: p.stats.reduce((sum, s) => sum + s.base_stat, 0),
  };
}

const ids = Array.from({ length: 150 }, (_, i) => i + 1);
const out = [];
const batchSize = 15;
for (let i = 0; i < ids.length; i += batchSize) {
  const batch = ids.slice(i, i + batchSize);
  out.push(...(await Promise.all(batch.map(fetchOne))));
  process.stdout.write(`fetched ${out.length}/150\n`);
}

out.sort((a, b) => a.id - b.id);
await import("node:fs/promises").then((fs) =>
  fs.mkdir(new URL(".", OUT), { recursive: true }),
);
await import("node:fs/promises").then((fs) =>
  fs.writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`),
);
console.log(`wrote ${OUT.pathname}`);
