import { Page, APIRequestContext } from "@playwright/test";
import {
  addSnapshot,
  emptyRegistry,
  verifyIdentity,
  Registry,
} from "../../lib/usdc/model";
import seed from "../../data-library/network-research.json";
export async function networkRegistry() {
  const codes = ["HUMA", "KMNO", "MORPHO", "LINK"],
    ids = ["huma", "kamino", "morpho", "chainlink"];
  let g = await addSnapshot(
    emptyRegistry(),
    JSON.stringify({
      symbols: codes.map((baseAsset) => ({
        symbol: baseAsset + "USDC",
        baseAsset,
        quoteAsset: "USDC",
        status: "TRADING",
        isSpotTradingAllowed: true,
      })),
    }),
  );
  for (let i = 0; i < codes.length; i++) {
    g = verifyIdentity(g, `binance:${codes[i]}`, {
      coinGeckoId: `fixture-${ids[i]}`,
      sourceUrl: "https://example.com/identity",
      basis: "manual_evidence",
      verifiedAt: new Date().toISOString(),
      evidence: "Synthetic test identity mapping",
    });
    g.assets[i].businessIds = [ids[i]];
  }
  return g;
}
export async function putBrowser(
  page: Page,
  registry: Registry,
  graph: unknown = seed,
) {
  await page.goto("/discovery-history");
  await page.evaluate(
    async ({ registry, graph }) => {
      async function put(name: string, store: string, value: unknown) {
        await new Promise<void>((resolve, reject) => {
          const r = indexedDB.open(name, 1);
          r.onupgradeneeded = () => r.result.createObjectStore(store);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction(store, "readwrite");
            tx.objectStore(store).put(value, "current");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          r.onerror = () => reject(r.error);
        });
      }
      await put("bd-oracle-usdc", "registry", registry);
      await put("bd-oracle-network", "workspace", graph);
    },
    { registry, graph },
  );
}
export async function seedServerRegistry(
  request: APIRequestContext,
  registry?: Registry,
) {
  const current = await (await request.get("/api/usdc/workspace")).json();
  const g = {
    ...(registry || (await networkRegistry())),
    revision: current.revision,
  };
  const r = await request.post("/api/usdc/workspace", { data: g });
  if (!r.ok()) throw new Error(await r.text());
}
