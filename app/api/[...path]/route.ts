import { usdcAPI } from "@/lib/usdc/server";
import { networkAPI, networkPath } from "@/lib/network/api";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const reads = new Set([
  "overview",
  "assets",
  "detail",
  "quality",
  "anatomy",
  "asset_anatomy",
  "unresolved_graph",
  "taxonomy",
  "intelligence_status",
  "list_proposals",
]);
const writes = new Set([
  "save_framework",
  "import_proposal",
  "review_proposal",
  "save_graph_node",
  "save_graph_edge",
  "retract_graph_edge",
  "save_evidence",
  "save_entity",
  "save_claim",
  "save_link",
  "save_activity",
  "verify_contract",
  "resolve",
  "unresolve",
  "save_relationship",
  "save_opportunity",
]);

// Local-only by design. No public binding or unauthenticated remote deployment.
function localRequest(req: NextRequest) {
  const host = req.headers.get("host");
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))
    return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`)
    return false;
  const site = req.headers.get("sec-fetch-site");
  return site !== "cross-site";
}
function rpc(action: string, data: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON_BIN || "python3",
      ["-m", "terminal", "rpc"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERMINAL_DATA_DIR:
            process.env.TERMINAL_DATA_DIR || path.join(process.cwd(), "data"),
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let output = "",
      errors = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Database request timed out"));
    }, 30000);
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 20_000_000) child.kill();
    });
    child.stderr.on("data", (b) => {
      errors += b;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error("Database RPC failed", errors);
        reject(new Error("Database request failed"));
        return;
      }
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("Invalid database response"));
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ action, data }));
  });
}
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: networkSegments } = await context.params;
  if (networkSegments[0] === "usdc") return usdcAPI(req, networkSegments);
  if (networkPath(networkSegments)) return networkAPI(req, networkSegments);
  if (process.env.VERCEL === "1" || process.env.BD_ORACLE_PREVIEW === "1")
    return NextResponse.json(
      { error: "Research storage is not connected to this hosted preview." },
      { status: 403 },
    );
  if (!localRequest(req))
    return NextResponse.json(
      { error: "This terminal accepts same-origin local requests only." },
      { status: 403 },
    );
  const { path: segments } = await context.params;
  const action = segments.join("/");
  if (!reads.has(action) && !writes.has(action))
    return NextResponse.json({ error: "Unknown operation" }, { status: 404 });
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ error: "JSON required" }, { status: 415 });
  try {
    const body = await req.text();
    if (body.length > 100_000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const result = (await rpc(action, JSON.parse(body))) as {
      data?: unknown;
      error?: string;
    };
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof SyntaxError
            ? "Invalid JSON"
            : "Could not complete request. Check terminal logs.",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path[0] === "usdc") return usdcAPI(req, path);
  if (networkPath(path)) return networkAPI(req, path);
  return NextResponse.json({ error: "Unknown operation" }, { status: 404 });
}
