import { z } from "zod";
import {
  parsePairs,
  type Snapshot as LegacySnapshot,
} from "../browser-discovery";
const date = z.iso.datetime({ offset: true }),
  code = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  url = z.url().refine((s) => s.startsWith("https://"));
const pair = z
  .object({
    symbol: code,
    baseAsset: code,
    quoteAsset: z.literal("USDC"),
    status: z.string().min(1),
    spot: z.boolean(),
  })
  .strict();
const verification = z
  .object({
    coinGeckoId: code,
    sourceUrl: url,
    basis: z.enum(["exchange_cross_reference", "manual_evidence"]),
    verifiedAt: date,
    evidence: z.string().min(1).max(10000),
  })
  .strict();
export const assetSchema = z
  .object({
    id: z.string(),
    code,
    firstSeenAt: date,
    lastSeenAt: date,
    lastActiveAt: date.nullable(),
    listingStatus: z.enum(["active", "absent", "suspended"]),
    symbols: z.array(code),
    identity: verification.nullable(),
    identityHistory: z.array(
      z.object({
        at: date,
        previousId: z.string().nullable(),
        verification: verification.nullable(),
      }),
    ),
    businessIds: z.array(z.string().max(160)).max(30),
  })
  .strict();
export const metadataSchema = z
  .object({
    id: code,
    name: z.string().min(1).max(200),
    symbol: code,
    image: url.nullable(),
    marketCap: z.number().finite().nonnegative().nullable(),
    currency: z.literal("usd"),
    observedAt: date,
    providerUpdatedAt: date.nullable(),
    categories: z.array(z.string().max(200)).max(100),
    description: z.string().max(20000),
    website: z.string().max(2000),
    profileObservedAt: date.nullable(),
    raw: z.string().max(100000),
  })
  .strict();
export const registrySchema = z
  .object({
    format: z.literal("bd-oracle-usdc-v1"),
    revision: z.number().int().nonnegative(),
    assets: z.array(assetSchema).max(10000),
    metadata: z.array(metadataSchema).max(10000),
    snapshots: z
      .array(
        z
          .object({
            id: z.string().min(1),
            observedAt: date,
            method: z.enum(["fetch", "file", "server"]),
            rawGzip: z.string().max(10000000),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            pairs: z.array(pair),
          })
          .strict(),
      )
      .max(10000),
    errors: z
      .array(
        z.object({
          at: date,
          source: z.enum(["binance", "coingecko"]),
          message: z.string().max(3000),
        }),
      )
      .max(10000),
    identityScan: z
      .object({
        nextPage: z.number().int().min(1).max(101),
        startedAt: date,
        complete: z.boolean(),
        candidates: z
          .array(z.object({ base: code, coinId: code, sourceUrl: url }))
          .max(10000),
      })
      .nullable(),
  })
  .strict()
  .superRefine((g, ctx) => {
    for (const records of [g.assets, g.metadata, g.snapshots])
      if (new Set(records.map((r) => r.id)).size !== records.length)
        ctx.addIssue({
          code: "custom",
          message: "Duplicate registry identifier",
        });
    for (const a of g.assets)
      if (a.id !== `binance:${a.code}`)
        ctx.addIssue({
          code: "custom",
          message: "Invalid permanent listing identifier",
        });
  });
export type Registry = z.infer<typeof registrySchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export const emptyRegistry = (): Registry => ({
  format: "bd-oracle-usdc-v1",
  revision: 0,
  assets: [],
  metadata: [],
  snapshots: [],
  errors: [],
  identityScan: null,
});
export const validateRegistry = (v: unknown) => registrySchema.parse(v);
export function currentDirectory(g: Registry) {
  const rows = new Map<
    string,
    { id: string; assets: Asset[]; metadata?: Metadata }
  >();
  for (const a of g.assets) {
    if (a.listingStatus !== "active" || !a.identity) continue;
    const id = a.identity.coinGeckoId;
    const row = rows.get(id) || {
      id,
      assets: [],
      metadata: g.metadata.find((m) => m.id === id),
    };
    row.assets.push(a);
    rows.set(id, row);
  }
  return [...rows.values()];
}
export function rebuildAssets(g: Registry): Registry {
  const assets = new Map(
    g.assets.map((a) => [
      a.code,
      {
        ...a,
        symbols: [] as string[],
        lastActiveAt: null as string | null,
        listingStatus: "absent" as Asset["listingStatus"],
      },
    ]),
  );
  for (const s of [...g.snapshots].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  )) {
    const groups = new Map<string, typeof s.pairs>();
    for (const p of s.pairs)
      groups.set(p.baseAsset, [...(groups.get(p.baseAsset) || []), p]);
    for (const a of assets.values()) a.listingStatus = "absent";
    for (const [base, pairs] of groups) {
      const active = pairs.some((p) => p.spot && p.status === "TRADING");
      const a = assets.get(base) || {
        id: `binance:${base}`,
        code: base,
        firstSeenAt: s.observedAt,
        lastSeenAt: s.observedAt,
        lastActiveAt: null,
        listingStatus: "absent",
        symbols: [],
        identity: null,
        identityHistory: [],
        businessIds: [],
      };
      if (Date.parse(s.observedAt) < Date.parse(a.firstSeenAt))
        a.firstSeenAt = s.observedAt;
      a.lastSeenAt = s.observedAt;
      a.listingStatus = active ? "active" : "suspended";
      if (active) a.lastActiveAt = s.observedAt;
      a.symbols = [...new Set([...a.symbols, ...pairs.map((p) => p.symbol)])];
      assets.set(base, a);
    }
  }
  return { ...g, assets: [...assets.values()] };
}
export async function gzip(raw: string) {
  const data = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (let i = 0; i < data.length; i += 8192)
    binary += String.fromCharCode(...data.slice(i, i + 8192));
  return btoa(binary);
}
export async function ungzip(value: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
    reader = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 25_000_000) {
      await reader.cancel();
      throw new Error("Decompressed snapshot exceeds 25 MB");
    }
    chunks.push(r.value);
  }
  return new Blob(chunks as BlobPart[]).text();
}
export async function digest(raw: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function addSnapshot(
  g: Registry,
  raw: string,
  observedAt = new Date().toISOString(),
  method: "fetch" | "file" | "server" = "fetch",
  id = crypto.randomUUID(),
): Promise<Registry> {
  if (raw.length > 25_000_000) throw new Error("Snapshot exceeds 25 MB");
  const pairs = parsePairs(raw)
    .filter((p) => p.quoteAsset === "USDC")
    .map(({ symbol, baseAsset, status, spot }) => ({
      symbol,
      baseAsset,
      quoteAsset: "USDC" as const,
      status,
      spot,
    }));
  if (!pairs.length)
    throw new Error(
      "Unexpected empty USDC market list. Previous snapshot retained; investigate before recording an empty universe.",
    );
  const hash = await digest(raw),
    existing = g.snapshots.find((s) => s.id === id);
  if (existing) {
    if (existing.sha256 !== hash) throw new Error("Snapshot ID conflict");
    return g;
  }
  return validateRegistry(
    rebuildAssets({
      ...g,
      snapshots: [
        ...g.snapshots,
        {
          id,
          observedAt,
          method,
          sha256: hash,
          rawGzip: await gzip(raw),
          pairs,
        },
      ].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)),
    }),
  );
}
export async function adoptLegacy(g: Registry, snapshots: LegacySnapshot[]) {
  let next = g;
  for (const s of snapshots) {
    if (
      next.snapshots.some((x) => x.id === s.id) ||
      !parsePairs(s.raw).some((p) => p.quoteAsset === "USDC")
    )
      continue;
    next = await addSnapshot(next, s.raw, s.obtainedAt, s.method, s.id);
  }
  return next;
}
export function verifyIdentity(
  g: Registry,
  assetId: string,
  value: Asset["identity"],
): Registry {
  const a = g.assets.find((a) => a.id === assetId);
  if (!a) throw new Error("Asset not found");
  return validateRegistry({
    ...g,
    assets: g.assets.map((a) =>
      a.id === assetId
        ? {
            ...a,
            identity: value,
            identityHistory: [
              ...a.identityHistory,
              {
                at: new Date().toISOString(),
                previousId: a.identity?.coinGeckoId || null,
                verification: value,
              },
            ],
          }
        : a,
    ),
  });
}
export function recordError(
  g: Registry,
  source: "binance" | "coingecko",
  message: string,
): Registry {
  return {
    ...g,
    errors: [
      ...g.errors,
      { at: new Date().toISOString(), source, message: message.slice(0, 3000) },
    ].slice(-10000),
  };
}
export async function validateBackup(v: unknown) {
  const g = validateRegistry(v);
  for (const s of g.snapshots) {
    const raw = await ungzip(s.rawGzip);
    if ((await digest(raw)) !== s.sha256)
      throw new Error("Snapshot checksum mismatch");
    const p = parsePairs(raw)
      .filter((p) => p.quoteAsset === "USDC")
      .map(({ symbol, baseAsset, status, spot }) => ({
        symbol,
        baseAsset,
        quoteAsset: "USDC",
        status,
        spot,
      }));
    if (JSON.stringify(p) !== JSON.stringify(s.pairs))
      throw new Error("Snapshot observations do not match raw evidence");
  }
  const rebuilt = rebuildAssets({ ...g, assets: [] });
  for (const a of g.assets) {
    const b = rebuilt.assets.find((b) => b.id === a.id);
    if (
      !b ||
      [
        "firstSeenAt",
        "lastSeenAt",
        "lastActiveAt",
        "listingStatus",
        "symbols",
      ].some(
        (k) =>
          JSON.stringify(a[k as keyof Asset]) !==
          JSON.stringify(b[k as keyof Asset]),
      )
    )
      throw new Error("Registry history mismatch");
  }
  if (rebuilt.assets.length !== g.assets.length)
    throw new Error("Registry assets missing");
  return g;
}
export function mergeRegistry(a: Registry, b: Registry) {
  const merge = <T extends { id: string }>(old: T[], incoming: T[]) => {
    const m = new Map(old.map((r) => [r.id, r]));
    for (const r of incoming) {
      const prev = m.get(r.id);
      if (prev && JSON.stringify(prev) !== JSON.stringify(r))
        throw new Error(
          `Conflicting record ${r.id}; reconcile backups before import.`,
        );
      m.set(r.id, r);
    }
    return [...m.values()];
  };
  return validateRegistry(
    rebuildAssets({
      ...a,
      assets: merge(a.assets, b.assets),
      metadata: merge(a.metadata, b.metadata),
      snapshots: merge(a.snapshots, b.snapshots).sort(
        (x, y) => Date.parse(x.observedAt) - Date.parse(y.observedAt),
      ),
      errors: [...a.errors, ...b.errors].slice(-10000),
    }),
  );
}
