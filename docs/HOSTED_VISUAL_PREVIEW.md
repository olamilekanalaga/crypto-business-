# Animated opportunity explorer

The existing project now has a dark, responsive homepage for explaining economic connections. `/research` retains the complete local terminal. Existing asset, business, graph, evidence and collection workflows remain in place.

The homepage is a presentation layer: selecting steps changes the explanation, play/pause controls the walkthrough, business-needs and opportunity panels explain feasibility and attribution, and a hypothetical calculator compares attributable annual net revenue with an agreed percentage. It never asserts that either company has agreed to pay an introducer.

## Case provenance

The user supplied the Huma × Kamino case. Official Huma documentation was additionally inspected on 2026-10-29:

- Source: https://docs.huma.finance/products/huma-2.0/integrations
- Original excerpt: “Borrowing USDC or USDS against their deposited PST.”
- Source type: first-party documentation; source-reported integration capability, not independent on-chain verification.
- Interpretation: a token representing an existing position can gain another use when a lending venue accepts it as collateral. This may create borrowing activity and demand for liquidity.
- Unknowns: current market parameters, incremental users, attributable net revenue, integration costs, budget size, and external business-development compensation.

The diagram is illustrative economic analysis. It supplies no current market totals or verified commercial outcomes and writes no facts into the research database. The documentation describes incentives; that does not establish a budget for an outside introducer. Original dated evidence and validated commercial outcomes can later be entered in the local research workspace.

## Hosting boundary

Vercel automatically sets `VERCEL=1`. This enables the concept-preview boundary. `BD_ORACLE_PREVIEW=1` exercises the same boundary locally. The homepage does not call the research API. All private research routes show an explanation; API operations return 403 before starting Python. No private records, local database or credentials are included in the Git deployment.

The preview is accessible wherever its Vercel deployment is accessible. It does not claim to be an authenticated private research service. Online research requires a supported backend runtime, durable database storage and authentication. The CEX pipeline continues to run locally, and its previously recorded network blocker remains unchanged.

## Verification on 2026-10-29

- All 94 Python tests passed; no collector, Python service or database migration files changed.
- All 12 Playwright journeys passed: nine existing research journeys and three new walkthrough, calculator and mobile/reduced-motion journeys. The local terminal tests start at `/research`; existing deep links and persistence assertions remain intact.
- Production build and TypeScript passed with the hosted-preview boundary enabled.
- Chromium production smoke test: homepage and compensation calculation work; no JavaScript errors or automatic research API calls; 390px screen has no horizontal overflow.
- Production route checks: `/research`, `/?view=workspace`, `/anatomy`, `/network`, `/assets/1/anatomy` and `/businesses/1` show the hosted storage explanation. `/api/overview` rejects requests with 403 before Python executes.
- Screenshots: [desktop](images/opportunity-desktop.png), [mobile](images/opportunity-mobile.png).

## Git deployment

The user imported the repository into Vercel and authorized pushing the visual update. GitHub recorded a successful Vercel deployment for the initial `main` commit, while the research implementation was on the feature branch. Release should fast-forward `main` to the tested implementation, preserving all existing history. Never force-push or silently overwrite newer remote changes.
