import { z } from "zod";
import {
  Registry,
  verifyIdentity,
  Metadata,
  metadataSchema,
  validateRegistry,
} from "./model";
export type CGFetch = (path: string) => Promise<unknown>;
export async function publicCG(path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(`https://api.coingecko.com/api/v3/${path}`, {
      signal: AbortSignal.timeout(25000),
      credentials: "omit",
    });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && attempt === 0) {
      const delay = Number(r.headers.get("retry-after") || 7);
      if (delay > 30)
        throw new Error(
          `CoinGecko requests a ${delay}s pause. Retry later; existing data is kept.`,
        );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(7, delay) * 1000),
      );
      continue;
    }
    throw new Error(
      `CoinGecko HTTP ${r.status}. Your plan may require an API key; configure it server-side or import a verified backup.`,
    );
  }
  throw new Error("CoinGecko unavailable");
}
const ticker = z.object({
  base: z.string(),
  target: z.string(),
  coin_id: z.string().nullish(),
  target_coin_id: z.string().nullish(),
  market: z.object({ identifier: z.string() }),
  is_stale: z.boolean().optional(),
  is_anomaly: z.boolean().optional(),
});
export async function scanIdentityPage(
  g: Registry,
  fetcher: CGFetch = publicCG,
): Promise<Registry> {
  const scan =
    g.identityScan && !g.identityScan.complete
      ? g.identityScan
      : {
          nextPage: 1,
          startedAt: new Date().toISOString(),
          complete: false,
          candidates: [],
        };
  if (scan.nextPage > 100)
    throw new Error(
      "Identity scan exceeded 100 pages. No automatic matches applied.",
    );
  const sourceUrl = `https://api.coingecko.com/api/v3/exchanges/binance/tickers?order=base_target&page=${scan.nextPage}&depth=false`;
  const payload = z
    .object({ tickers: z.array(ticker).max(100) })
    .parse(await fetcher(sourceUrl.split("/api/v3/")[1]));
  const codes = new Set(g.assets.map((a) => a.code));
  const candidates = [
    ...scan.candidates,
    ...payload.tickers
      .filter(
        (t) =>
          typeof t.coin_id === "string" &&
          /^[A-Za-z0-9_.-]{1,100}$/.test(t.coin_id) &&
          codes.has(t.base) &&
          t.target === "USDC" &&
          t.target_coin_id === "usd-coin" &&
          t.market.identifier === "binance" &&
          t.is_stale === false &&
          t.is_anomaly === false,
      )
      .map((t) => ({ base: t.base, coinId: t.coin_id!, sourceUrl })),
  ];
  const complete = payload.tickers.length < 100;
  let next: Registry = {
    ...g,
    identityScan: {
      ...scan,
      nextPage: scan.nextPage + 1,
      complete,
      candidates,
    },
  };
  if (complete) {
    for (const a of g.assets) {
      const matches = candidates.filter((c) => c.base === a.code),
        ids = new Set(matches.map((c) => c.coinId));
      if (ids.size !== 1) continue;
      const candidate = matches[0];
      if (a.identity) continue;
      next = verifyIdentity(next, a.id, {
        coinGeckoId: candidate.coinId,
        sourceUrl: candidate.sourceUrl,
        basis: "exchange_cross_reference",
        verifiedAt: new Date().toISOString(),
        evidence: JSON.stringify({
          exchange: "binance",
          base: a.code,
          quote: "USDC",
          coin_id: candidate.coinId,
          target_coin_id: "usd-coin",
          scanStartedAt: scan.startedAt,
          complete: true,
        }),
      });
    }
  }
  return validateRegistry(next);
}
const market = z
  .object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    image: z.string().nullable().optional(),
    market_cap: z.number().finite().nonnegative().nullable(),
    last_updated: z.string().nullable().optional(),
  })
  .passthrough();
export async function refreshMarketBatch(
  g: Registry,
  fetcher: CGFetch = publicCG,
): Promise<Registry> {
  // Oldest observations first; each explicit request makes at most one 50-ID API call.
  const ids = [
    ...new Set(
      g.assets
        .filter((a) => a.listingStatus === "active" && a.identity)
        .map((a) => a.identity!.coinGeckoId),
    ),
  ]
    .filter((id) => {
      const m = g.metadata.find((m) => m.id === id);
      return !m || Date.now() - Date.parse(m.observedAt) > 3600000;
    })
    .sort((a, b) =>
      (g.metadata.find((m) => m.id === a)?.observedAt || "").localeCompare(
        g.metadata.find((m) => m.id === b)?.observedAt || "",
      ),
    )
    .slice(0, 50);
  if (!ids.length) return g;
  const payload = z
    .array(market)
    .max(50)
    .parse(
      await fetcher(
        `coins/markets?vs_currency=usd&ids=${ids.map(encodeURIComponent).join(",")}&per_page=50&page=1&sparkline=false`,
      ),
    );
  if (
    !payload.length ||
    new Set(payload.map((p) => p.id)).size !== payload.length ||
    payload.some((p) => !ids.includes(p.id))
  )
    throw new Error(
      "Unexpected CoinGecko market response; old observations retained.",
    );
  const metadata = new Map(g.metadata.map((m) => [m.id, m]));
  for (const item of payload) {
    const old = metadata.get(item.id);
    metadata.set(
      item.id,
      metadataSchema.parse({
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        image: item.image?.startsWith("https://") ? item.image : null,
        marketCap: item.market_cap,
        currency: "usd",
        observedAt: new Date().toISOString(),
        providerUpdatedAt: item.last_updated || null,
        categories: old?.categories || [],
        description: old?.description || "",
        website: old?.website || "",
        profileObservedAt: old?.profileObservedAt || null,
        raw: JSON.stringify(item),
      }),
    );
  }
  return validateRegistry({ ...g, metadata: [...metadata.values()] });
}
export async function refreshProfile(
  g: Registry,
  id: string,
  fetcher: CGFetch = publicCG,
): Promise<Registry> {
  const old = g.metadata.find((m) => m.id === id);
  if (!old) throw new Error("Refresh verified metadata first.");
  if (
    old.profileObservedAt &&
    Date.now() - Date.parse(old.profileObservedAt) < 7 * 86400000
  )
    return g;
  const p = z
    .object({
      id: z.string(),
      categories: z.array(z.string()).default([]),
      description: z.object({ en: z.string().optional() }).optional(),
      links: z.object({ homepage: z.array(z.string()).optional() }).optional(),
    })
    .parse(
      await fetcher(
        `coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      ),
    );
  if (p.id !== id) throw new Error("CoinGecko identity mismatch");
  const record: Metadata = {
    ...old,
    categories: p.categories,
    description: (p.description?.en || "")
      .replace(/<[^>]*>/g, "")
      .slice(0, 20000),
    website: p.links?.homepage?.find((s) => s.startsWith("https://")) || "",
    profileObservedAt: new Date().toISOString(),
  };
  return validateRegistry({
    ...g,
    metadata: g.metadata.map((m) => (m.id === id ? record : m)),
  });
}
