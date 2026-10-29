import {
  validateClassification,
  type Classification,
} from "./product-classification";
export const BINANCE_URL =
  "https://data-api.binance.vision/api/v3/exchangeInfo";
export type Pair = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  spot: boolean;
  available: boolean;
};
export type Snapshot = {
  id: string;
  obtainedAt: string;
  method: "fetch" | "file";
  raw: string;
};
export type Workspace = {
  format: "bd-oracle-browser-v1";
  snapshots: Snapshot[];
  notes: Record<string, string>;
  classifications?: Record<string, Classification>;
};
export const emptyWorkspace = (): Workspace => ({
  format: "bd-oracle-browser-v1",
  snapshots: [],
  notes: {},
  classifications: {},
});

export function parsePairs(raw: string): Pair[] {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.symbols) || !data.symbols.length)
    throw new Error(
      "Expected Binance exchangeInfo JSON containing a non-empty symbols list.",
    );
  const seen = new Set<string>();
  return data.symbols.map((item: Record<string, unknown>) => {
    if (
      !item ||
      ["symbol", "baseAsset", "quoteAsset", "status"].some(
        (k) => typeof item[k] !== "string" || !(item[k] as string).trim(),
      )
    )
      throw new Error(
        "Invalid trading pair. Your previous dataset has been kept.",
      );
    if (seen.has(item.symbol as string))
      throw new Error("Duplicate pair symbol in snapshot. Import rejected.");
    seen.add(item.symbol as string);
    let spot = item.isSpotTradingAllowed;
    if (spot === undefined)
      spot =
        (Array.isArray(item.permissions) &&
          item.permissions.includes("SPOT")) ||
        (Array.isArray(item.permissionSets) &&
          item.permissionSets.some(
            (g) => Array.isArray(g) && g.includes("SPOT"),
          ));
    if (typeof spot !== "boolean") throw new Error("Invalid Spot permission.");
    return {
      symbol: item.symbol,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      status: item.status,
      spot,
      available: true,
    } as Pair;
  });
}

export function importWorkspace(text: string): Workspace | null {
  const input = JSON.parse(text);
  if (!input || input.format !== "bd-oracle-browser-v1") return null;
  if (
    !Array.isArray(input.snapshots) ||
    !input.notes ||
    typeof input.notes !== "object" ||
    Array.isArray(input.notes)
  )
    throw new Error("Invalid workspace backup.");
  const ids = new Set<string>();
  const snapshots = input.snapshots.map((s: Snapshot) => {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id ||
      ids.has(s.id) ||
      typeof s.obtainedAt !== "string" ||
      !Number.isFinite(Date.parse(s.obtainedAt)) ||
      !["fetch", "file"].includes(s.method) ||
      typeof s.raw !== "string"
    )
      throw new Error("Invalid snapshot history.");
    parsePairs(s.raw);
    ids.add(s.id);
    return { id: s.id, obtainedAt: s.obtainedAt, method: s.method, raw: s.raw };
  });
  const notes: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(input.notes)) {
    if (typeof value !== "string" || value.length > 20000)
      throw new Error("Invalid research note.");
    notes[key] = value;
  }
  const classifications: Record<string, Classification> = Object.create(null);
  if (input.classifications !== undefined) {
    if (
      !input.classifications ||
      typeof input.classifications !== "object" ||
      Array.isArray(input.classifications)
    )
      throw new Error("Invalid classifications backup.");
    for (const [asset, record] of Object.entries(input.classifications))
      classifications[asset] = validateClassification(record);
  }
  return { format: "bd-oracle-browser-v1", snapshots, notes, classifications };
}

export function mergeWorkspace(
  current: Workspace,
  incoming: Workspace,
): Workspace {
  const snapshots = new Map(current.snapshots.map((s) => [s.id, s]));
  for (const s of incoming.snapshots) {
    const old = snapshots.get(s.id);
    if (
      old &&
      (old.raw !== s.raw ||
        old.obtainedAt !== s.obtainedAt ||
        old.method !== s.method)
    )
      throw new Error("Snapshot ID conflict. No data was changed.");
    snapshots.set(s.id, s);
  }
  const notes: Record<string, string> = Object.assign(
    Object.create(null),
    current.notes,
  );
  for (const [key, value] of Object.entries(incoming.notes)) {
    if (!notes[key]) notes[key] = value;
    else if (value && notes[key] !== value && !notes[key].includes(value))
      notes[key] += "\n\n[Imported note]\n" + value;
    if (notes[key].length > 20000)
      throw new Error(
        "Merged note exceeds 20,000 characters. Shorten it before merging; existing data is unchanged.",
      );
  }
  const classifications: Record<string, Classification> = Object.assign(
    Object.create(null),
    current.classifications || {},
  );
  for (const [asset, record] of Object.entries(
    incoming.classifications || {},
  )) {
    const existing = classifications[asset];
    if (existing && JSON.stringify(existing) !== JSON.stringify(record))
      throw new Error(
        `Classification conflict for ${asset}. Import cancelled; export both workspaces and reconcile the classification before merging.`,
      );
    classifications[asset] = record;
  }
  return {
    format: "bd-oracle-browser-v1",
    classifications,
    snapshots: [...snapshots.values()].sort(
      (a, b) => Date.parse(a.obtainedAt) - Date.parse(b.obtainedAt),
    ),
    notes,
  };
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bd-oracle-discovery", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. You can still download a backup.",
        ),
      );
  });
}
export async function readWorkspace(): Promise<Workspace> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db
        .transaction("workspace")
        .objectStore("workspace")
        .get("current");
      r.onsuccess = () => {
        try {
          const value = r.result
            ? importWorkspace(JSON.stringify(r.result))
            : emptyWorkspace();
          if (!value)
            throw new Error("Browser backup format is not recognized.");
          resolve(value);
        } catch (e) {
          reject(e);
        }
      };
      r.onerror = () => reject(new Error("Could not read browser storage."));
    });
  } finally {
    db.close();
  }
}
export async function writeWorkspace(workspace: Workspace) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put(workspace, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            "Could not save to this browser. Download a backup before closing this page.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
