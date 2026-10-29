import { z } from "zod";
import {
  authorize,
  loadGraph,
  saveGraph,
  NetworkError,
  hosted,
  rpc,
} from "./server";
import {
  businessNetwork,
  allRelationships,
  reviewRelationship,
} from "./matching";
import { validateGraph } from "./model";
import { analyze } from "./ai";
export function networkPath(path: string[]) {
  return (
    ["businesses", "relationships", "sources"].includes(path[0]) ||
    path.join("/") === "network/workspace" ||
    path.join("/") === "research/analyze"
  );
}
export async function networkAPI(req: Request, path: string[]) {
  try {
    authorize(req);
    const [area, id, action] = path;
    if (req.method === "GET" && area === "sources" && id === "status") {
      const quality =
        !hosted() && !process.env.DATABASE_URL ? await rpc("quality") : null;
      return json({
        storage: process.env.DATABASE_URL ? "postgres" : "sqlite",
        aiEnabled:
          process.env.BDO_AI_ENABLED === "1" &&
          !!process.env.OPENAI_API_KEY &&
          !!process.env.OPENAI_MODEL,
        automatedJobs: "Not configured by this deployment",
        quality,
        collectors: {
          binance:
            "Existing Python connector; browser collection remains available",
          coingecko: "Existing Python enrichment with cache; API limits apply",
          otherExchanges: "Not connected",
        },
      });
    }
    const g = await loadGraph();
    if (req.method === "GET") {
      if (area === "network") return json(g);
      if (area === "businesses") {
        if (!id) {
          const url = new URL(req.url),
            q = (url.searchParams.get("q") || "").toLowerCase(),
            sector = url.searchParams.get("sector");
          return json(
            g.businesses.filter(
              (b) =>
                b.name.toLowerCase().includes(q) &&
                (!sector || b.sectors.includes(sector)),
            ),
          );
        }
        const b = g.businesses.find((b) => b.id === id);
        if (!b) throw new NetworkError("Business not found", 404);
        return json(
          action === "network"
            ? {
                business: b,
                relationships: businessNetwork(g, id),
                businesses: g.businesses,
                sources: g.sources,
              }
            : {
                ...b,
                sources: g.sources.filter((s) => b.sourceIds.includes(s.id)),
              },
        );
      }
      if (area === "relationships") {
        const r = allRelationships(g).find((r) => r.id === id);
        if (!r) throw new NetworkError("Relationship not found", 404);
        return json({
          ...r,
          evidence: g.sources.filter((s) => r.sourceIds.includes(s.id)),
        });
      }
    }
    if (req.method === "POST") {
      if (!req.headers.get("content-type")?.startsWith("application/json"))
        throw new NetworkError("JSON required", 415);
      const raw = await req.text();
      if (raw.length > 5_000_000)
        throw new NetworkError("Request exceeds 5 MB", 413);
      const body = JSON.parse(raw);
      if (area === "network") return json(await saveGraph(validateGraph(body)));
      if (area === "relationships" && action === "review") {
        const input = z
          .object({
            revision: z.number().int(),
            review: z.enum(["pending", "accepted", "rejected"]),
            note: z.string().max(6000),
            saved: z.boolean(),
          })
          .strict()
          .parse(body);
        if (input.revision !== g.revision)
          throw new NetworkError("Revision conflict. Reload research.", 409);
        return json(
          await saveGraph(
            reviewRelationship(g, id, input.review, input.note, input.saved),
          ),
        );
      }
      if (area === "research" && id === "analyze") {
        const input = z
          .object({ businessId: z.string(), revision: z.number().int() })
          .strict()
          .parse(body);
        if (input.revision !== g.revision)
          throw new NetworkError("Revision conflict", 409);
        return json(await saveGraph(await analyze(g, input.businessId)));
      }
    }
    throw new NetworkError("Unknown network operation", 404);
  } catch (e) {
    if (e instanceof NetworkError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => i.message)
            .slice(0, 3)
            .join("; "),
        },
        400,
      );
    if (e instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
    console.error("Network API failed", e instanceof Error ? e.name : "Error");
    return json(
      {
        error:
          "Research storage unavailable. Check database setup and server logs; no client secrets are required.",
      },
      503,
    );
  }
}
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}
