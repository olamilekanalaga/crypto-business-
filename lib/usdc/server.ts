import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  authorize,
  hosted,
  postgres,
  rpc,
  NetworkError,
} from "../network/server";
import {
  Registry,
  emptyRegistry,
  validateRegistry,
  validateBackup,
  addSnapshot,
  recordError,
} from "./model";
import { BINANCE_URL } from "../browser-discovery";
export async function loadServerRegistry(): Promise<Registry> {
  if (!hosted() && !process.env.DATABASE_URL) {
    const v = await rpc("usdc_load");
    return v ? validateRegistry(v) : emptyRegistry();
  }
  const { rows } = await postgres().query(
    "SELECT document,revision FROM bd_usdc_registry WHERE id=1",
  );
  return rows.length
    ? validateRegistry({ ...rows[0].document, revision: rows[0].revision })
    : emptyRegistry();
}
export async function saveServerRegistry(value: Registry): Promise<Registry> {
  const g = validateRegistry(value);
  if (!hosted() && !process.env.DATABASE_URL)
    return validateRegistry(await rpc("usdc_save", { document: g }));
  const next = { ...g, revision: g.revision + 1 };
  const insert = await postgres().query(
    "INSERT INTO bd_usdc_registry(id,revision,document) SELECT 1,1,$1::jsonb WHERE $2=0 ON CONFLICT(id) DO NOTHING RETURNING revision",
    [JSON.stringify(next), g.revision],
  );
  if (insert.rows.length) return next;
  const update = await postgres().query(
    "UPDATE bd_usdc_registry SET document=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision",
    [JSON.stringify(next), g.revision],
  );
  if (!update.rows.length)
    throw new NetworkError(
      "Registry revision conflict. Reload before saving.",
      409,
    );
  return next;
}
export async function serverCG(path: string) {
  const url = new URL(`https://api.coingecko.com/api/v3/${path}`);
  if (
    url.origin !== "https://api.coingecko.com" ||
    !/^\/api\/v3\/(exchanges\/binance\/tickers|coins\/markets|coins\/[a-z0-9_-]+)$/.test(
      url.pathname,
    )
  )
    throw new NetworkError("Unsupported metadata endpoint");
  const allowed = [
    "order",
    "page",
    "depth",
    "vs_currency",
    "ids",
    "per_page",
    "sparkline",
    "localization",
    "tickers",
    "market_data",
    "community_data",
    "developer_data",
  ];
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key))
      throw new NetworkError("Unsupported metadata parameter");
  if (url.searchParams.get("ids")?.split(",").length! > 50)
    throw new NetworkError("At most 50 IDs per request");
  const key = process.env.COINGECKO_DEMO_API_KEY;
  const response = await fetch(url, {
    headers: key ? { "x-cg-demo-api-key": key } : {},
    signal: AbortSignal.timeout(25000),
    next: { revalidate: 3600 },
  });
  if (!response.ok)
    throw new NetworkError(
      `CoinGecko HTTP ${response.status}. Previous observations retained; check API allowance.`,
      502,
    );
  return response.json();
}
export async function usdcAPI(req: Request, path: string[]) {
  const json = (data: unknown, status = 200) =>
    Response.json(data, {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
    });
  try {
    const action = path[1];
    if (action === "daily") {
      const secret = process.env.CRON_SECRET || "",
        provided = req.headers.get("authorization") || "";
      const expected = `Bearer ${secret}`;
      if (
        req.method !== "GET" ||
        secret.length < 32 ||
        provided.length !== expected.length ||
        !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
      )
        throw new NetworkError(
          "Daily scheduler is not configured or authorized.",
          401,
        );
    } else authorize(req);
    if (req.method === "GET" && action === "workspace")
      return json(await loadServerRegistry());
    if (req.method === "POST" && action === "workspace") {
      const raw = await req.text();
      if (raw.length > 4_000_000)
        throw new NetworkError(
          "Server transfer exceeds 4 MB. Use local backups or migrate historical archives separately.",
          413,
        );
      return json(
        await saveServerRegistry(await validateBackup(JSON.parse(raw))),
      );
    }
    if (req.method === "POST" && action === "coingecko") {
      const raw = await req.text();
      if (raw.length > 5000)
        throw new NetworkError("Metadata request too large", 413);
      const body = z
        .object({ path: z.string().max(4000) })
        .strict()
        .parse(JSON.parse(raw));
      return json(await serverCG(body.path));
    }
    if (
      (req.method === "POST" && action === "refresh") ||
      (req.method === "GET" && action === "daily")
    ) {
      const g = await loadServerRegistry();
      const last = g.snapshots.at(-1);
      if (
        action === "daily" &&
        last &&
        Date.now() - Date.parse(last.observedAt) < 23 * 3600000
      )
        return json({ skipped: true, lastSuccessfulSync: last.observedAt });
      try {
        const response = await fetch(BINANCE_URL, {
          cache: "no-store",
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
        const next = await addSnapshot(
          g,
          await response.text(),
          new Date().toISOString(),
          "server",
        );
        return json(await saveServerRegistry(next));
      } catch (e) {
        if (e instanceof NetworkError && e.status === 409) throw e;
        await saveServerRegistry(
          recordError(g, "binance", (e as Error).message),
        );
        throw new NetworkError(
          "Binance refresh failed; the last successful snapshot and research were kept.",
          502,
        );
      }
    }
    throw new NetworkError("Unknown USDC operation", 404);
  } catch (e) {
    if (e instanceof NetworkError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return json(
        {
          error:
            "Invalid registry or metadata request. Previous data retained.",
        },
        400,
      );
    return json(
      {
        error:
          "Registry storage unavailable. Configure persistent Postgres and run its migrations.",
      },
      503,
    );
  }
}
