export const CATEGORIES = [
  "Yield",
  "Staking",
  "Meme",
  "Blockchain",
  "Infrastructure",
  "RWA",
  "NFT",
  "Lending",
  "DEX",
  "Gaming",
  "Payments",
  "Stablecoin",
  "Oracle",
  "Data",
  "AI",
  "DePIN",
  "Wallet",
  "Privacy",
  "Interoperability",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Classification = {
  project: string;
  categories: Category[];
  description: string;
  source: string;
  status: "needs_review" | "reviewed";
  updatedAt: string;
};
export const blankClassification = (): Classification => ({
  project: "",
  categories: [],
  description: "",
  source: "",
  status: "needs_review",
  updatedAt: "",
});
export function validateClassification(input: unknown): Classification {
  if (!input || typeof input !== "object")
    throw new Error("Invalid product classification.");
  const c = input as Classification;
  if (
    ![c.project, c.description, c.source, c.updatedAt].every(
      (v) => typeof v === "string",
    ) ||
    c.project.length > 200 ||
    c.description.length > 4000 ||
    c.source.length > 2000 ||
    !Array.isArray(c.categories) ||
    c.categories.some((v) => !CATEGORIES.includes(v)) ||
    new Set(c.categories).size !== c.categories.length ||
    !["needs_review", "reviewed"].includes(c.status) ||
    !Number.isFinite(Date.parse(c.updatedAt))
  )
    throw new Error("Invalid product classification fields.");
  if (c.source) {
    let url: URL;
    try {
      url = new URL(c.source);
    } catch {
      throw new Error("Use a full https:// or http:// source URL.");
    }
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Use a web source URL.");
  }
  if (
    c.status === "reviewed" &&
    (!c.project.trim() ||
      !c.source ||
      !c.description.trim() ||
      !c.categories.length)
  )
    throw new Error(
      "To mark reviewed, add a project, categories, product explanation and source URL.",
    );
  return {
    project: c.project,
    categories: [...c.categories],
    description: c.description,
    source: c.source,
    status: c.status,
    updatedAt: c.updatedAt,
  };
}

// Research candidates only: ticker lookup never verifies a project association.
// First-party pages inspected 2026-10-29. No market or yield-rate claims.
const candidate = (
  project: string,
  categories: Category[],
  description: string,
  source: string,
): Classification => ({
  project,
  categories,
  description,
  source,
  status: "needs_review",
  updatedAt: "2026-10-29T00:00:00Z",
});
export const PRODUCT_CANDIDATES: Readonly<Record<string, Classification>> = {
  BTC: candidate(
    "Bitcoin",
    ["Blockchain", "Payments"],
    "Peer-to-peer money and payment network.",
    "https://bitcoin.org/en/",
  ),
  ETH: candidate(
    "Ethereum",
    ["Blockchain", "Staking"],
    "Smart-contract blockchain secured through staking.",
    "https://ethereum.org/staking/",
  ),
  SOL: candidate(
    "Solana",
    ["Blockchain", "Payments"],
    "Blockchain network for applications and payments.",
    "https://solana.com/",
  ),
  LINK: candidate(
    "Chainlink",
    ["Infrastructure", "Oracle", "Interoperability"],
    "Oracle data and cross-chain connectivity for applications.",
    "https://chain.link/",
  ),
  AAVE: candidate(
    "Aave",
    ["Lending", "Yield"],
    "Lending and borrowing products. A product category is not a claim that holding AAVE earns yield.",
    "https://aave.com/",
  ),
  LDO: candidate(
    "Lido",
    ["Staking", "Yield"],
    "Liquid staking products. LDO is distinct from the stETH staking receipt.",
    "https://lido.fi/",
  ),
  ONDO: candidate(
    "Ondo Finance",
    ["RWA", "Infrastructure"],
    "Platforms and products for tokenized financial assets. ONDO itself is not a tokenized Treasury product.",
    "https://ondo.finance/",
  ),
  DOGE: candidate(
    "Dogecoin",
    ["Meme", "Payments"],
    "Meme-origin digital currency used for payments.",
    "https://dogecoin.com/",
  ),
  IMX: candidate(
    "Immutable",
    ["Gaming", "Infrastructure"],
    "Platform and tools supporting games and player growth.",
    "https://www.immutable.com/",
  ),
  ENJ: candidate(
    "Enjin",
    ["NFT", "Gaming", "Infrastructure"],
    "Blockchain, wallet, marketplace and NFT tools for games.",
    "https://enjin.io/",
  ),
  PENDLE: candidate(
    "Pendle",
    ["Yield", "DEX"],
    "Products for trading and managing yield exposure.",
    "https://www.pendle.finance/",
  ),
};
export function productFor(
  asset: string,
  saved: Record<string, Classification> = {},
): Classification | undefined {
  return Object.hasOwn(saved, asset)
    ? saved[asset]
    : Object.hasOwn(PRODUCT_CANDIDATES, asset)
      ? PRODUCT_CANDIDATES[asset]
      : undefined;
}
