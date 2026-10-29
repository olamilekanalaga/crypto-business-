import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { Graph, emptyGraph, validateGraph } from "./model";
export class NetworkError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function hosted() {
  return process.env.VERCEL === "1" || process.env.BD_ORACLE_PREVIEW === "1";
}
export function authorize(req: Request) {
  const origin = req.headers.get("origin"),
    url = new URL(req.url);
  if (origin && origin !== url.origin)
    throw new NetworkError("Same-origin requests required", 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new NetworkError("Cross-site requests are not allowed", 403);
  const token = process.env.BDO_OWNER_TOKEN;
  if (token && token.length >= 32) {
    const supplied =
      req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    const hash = (s: string) => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(hash(token), hash(supplied)))
      throw new NetworkError(
        "Unlock private server research with your owner access token.",
        401,
      );
    return;
  }
  if (hosted())
    throw new NetworkError(
      "Private server access is not configured. Browser research remains available.",
      503,
    );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new NetworkError(
      "Local research accepts localhost requests only",
      403,
    );
}
export function rpc(action: string, data: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON_BIN || "python3",
      ["-m", "terminal", "rpc"],
      { cwd: process.cwd(), env: process.env, stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new NetworkError("Local database timeout", 504));
    }, 30000);
    child.stdout.on("data", (b) => {
      out += b;
      if (out.length > 8_000_000) {
        child.kill();
        reject(new NetworkError("Database response too large", 413));
      }
    });
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      reject(new NetworkError("Local Python database unavailable", 503));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error();
        const v = JSON.parse(out);
        if (v.error)
          throw new NetworkError(
            v.error,
            /conflict/i.test(v.error) ? 409 : 400,
          );
        resolve(v.data);
      } catch (e) {
        reject(
          e instanceof NetworkError
            ? e
            : new NetworkError("Local database request failed", 500),
        );
      }
    });
    child.stdin.end(JSON.stringify({ action, data }));
  });
}
let pool: Pool | undefined;
function postgres() {
  if (!process.env.DATABASE_URL)
    throw new NetworkError(
      "Connect persistent Postgres before enabling server research.",
      503,
    );
  return (pool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
  }));
}
function usePostgres() {
  return !!process.env.DATABASE_URL || hosted();
}
export async function loadGraph(): Promise<Graph> {
  if (!usePostgres()) {
    const data = await rpc("network_load");
    return data ? validateGraph(data) : emptyGraph();
  }
  const { rows } = await postgres().query(
    "SELECT document, revision FROM bd_network_workspace WHERE id=1",
  );
  return rows.length
    ? validateGraph({ ...rows[0].document, revision: rows[0].revision })
    : emptyGraph();
}
export async function saveGraph(graph: Graph): Promise<Graph> {
  const valid = validateGraph(graph);
  if (!usePostgres())
    return validateGraph(await rpc("network_save", { document: valid }));
  const next = { ...valid, revision: valid.revision + 1 };
  const { rows } = await postgres().query(
    `INSERT INTO bd_network_workspace(id,revision,document) SELECT 1,1,$1::jsonb WHERE $2=0 ON CONFLICT(id) DO NOTHING RETURNING revision`,
    [JSON.stringify(next), valid.revision],
  );
  if (rows.length) return next;
  const update = await postgres().query(
    "UPDATE bd_network_workspace SET revision=revision+1,document=$1::jsonb,updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision",
    [JSON.stringify(next), valid.revision],
  );
  if (!update.rows.length)
    throw new NetworkError(
      "Network changed on another device. Reload before saving; export your draft first.",
      409,
    );
  return next;
}
export async function reserveAI() {
  if (!usePostgres()) {
    await rpc("network_ai_reserve");
    return;
  }
  const { rows } = await postgres().query(
    "INSERT INTO bd_network_ai_usage(day,attempts) VALUES($1,1) ON CONFLICT(day) DO UPDATE SET attempts=bd_network_ai_usage.attempts+1 WHERE bd_network_ai_usage.attempts<10 RETURNING attempts",
    [new Date().toISOString().slice(0, 10)],
  );
  if (!rows.length)
    throw new NetworkError(
      "Daily AI request limit reached (10 attempts).",
      429,
    );
}
