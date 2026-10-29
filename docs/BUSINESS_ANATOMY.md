# Business Anatomy in BD Oracle

Business Anatomy helps you investigate what a business needs to function, grow and survive, and where another business—or your own work—might create value. It turns the personal Cřyptô Business research terminal into a Business Dependency & Opportunity Graph.

A node is a research subject. A connection is a specific economic claim with a meaning, explanation, certainty and evidence. Creating a node does not prove that an operating business exists; drawing a connection does not verify it.

## Start from a business, then follow a need

Open **Business Anatomy** in the sidebar or select an organisation/product in Business explorer. Organisation and product pages open their anatomy view first; use **Research** for the detailed economic questions, **Economic flow** for the actor-to-value sequence, and **Connections** for the original associations and relationship records.

Choose a **Centre node**, click a neighbouring map node, or open **Explore another node** and search. Every recorded business, need, capability, actor or resource can become the centre of its own immediate-neighbourhood map. **Back one step** retraces your exploration. Pan and zoom the canvas when useful; the node directory provides another way to navigate.

For example, you could research a business’s need for liquidity, make the Liquidity concept the centre, then inspect the actors and resources you have actually connected to it. The software does not generate providers merely because a concept has a familiar name.

## Keep the dimensions separate

| Dimension | What it records | What it does not establish |
| --- | --- | --- |
| Node kind | Organisation, product, need, capability, actor or resource | Whether a business is verified or a need applies to it |
| Connection type | The stated economic meaning and direction | A different relationship that sounds similar |
| Dependency importance | Essential, optional or unknown | Whether the connection has evidence |
| Relationship state | Existing or potential | Whether an asserted existing relationship is confirmed |
| Evidence status | Confirmed, inference, hypothesis or unknown | The truth of a source-independent guess |
| Anatomy lens | A question-organising tag | A universal model of how every company operates |

“Existing + hypothesis” records an unverified assertion about a current connection. “Potential” records a proposed connection, not a discovered contract. Confirmed claims require confirmed source evidence, and the researcher remains responsible for whether the source supports the specific interpretation.

The seven connection types are:

| Type | Read the direction as |
| --- | --- |
| Needs to operate | Source requires the target as an essential dependency |
| Needs to grow | Source could use the target as an optional growth input |
| Pays for | Source pays for the target; an unconfirmed payment hypothesis can remain unknown |
| Provides to | Source supplies something to the target |
| Partners with | Two organisation/product records have a claimed partnership |
| Could benefit from | Source could benefit from the target; always potential |
| Competes with | Two organisation/product records have a claimed competitive relationship |

The body of the connection explains what is supplied, why the connection matters, what economic value each side receives, whether money changes hands, and what still needs validation. Do not rely on a line label alone.

## Use the body analogy as questions

| Lens | Business equivalent | Questions to investigate |
| --- | --- | --- |
| Oxygen | Distribution and access | Who brings customers or users? Which sales channels, integrations or ecosystems help it reach them? |
| Blood | Capital and value circulation | Where do revenue, funding or liquidity enter? Who supplies them, and what is exchanged? |
| Brain | Information and coordination | What knowledge, developers, documentation and decisions keep the operation working? |
| Legs | Delivery and execution | What infrastructure and operations let it deliver its product? Which inputs are essential? |
| Food | Recurring inputs | What does it repeatedly consume? What services, hosting, data or work are costly or difficult to obtain? |

A company may use these lenses differently or have needs that fit none of them. **Whole business** shows all lenses; **Other / unassigned** retains connections without a body tag.

The four research cards ask:

1. What keeps it alive?
2. What helps it grow?
3. Who already supplies it?
4. Who else might help or benefit?

They surface recorded graph connections and applicable research findings. They are not generated company assessments. Filters change the visible neighbourhood, and “Not established in this view” must not be read as “this business has no such need.” Confirmed incoming supply edges support the provider question; proposed connections remain labelled as possibilities to investigate.

## Record your research

1. Create organisation/product records and source evidence in **Research workspace**. The graph represents those business records automatically but adds no inferred connections. Assets stay in the discovery/identity layer, not the operating-business graph.
2. Open **Record nodes & connections → Nodes** to define a need, capability, actor or resource. Give it a clear name and description. Concepts are separate records rather than assumed ticker identities.
3. Under **Connections**, select the source, type and target. Classify importance, existing/potential state, lens and evidence status independently.
4. Explain why the connection exists and what each endpoint receives. Leave money unknown unless specific confirmed evidence supports an explicit payment assertion.
5. Attach evidence and an observation date. Describe what remains unverified: actual demand, alternatives already used, technical fit, commercial viability, payment, or the existence of the relationship itself.
6. Inspect the saved connection’s original source excerpt separately from the researcher’s interpretation. Continue the investigation in your opportunity notebook when the need suggests a possible way to help.

The source library retains the URL, original excerpt/observation, observation date and verification status. The graph inspector exposes this evidence, the economic explanation and remaining gaps. It does not fetch or automatically verify source pages.

## Constraints that preserve meaning

- Confirmed connections require confirmed evidence.
- Potential connections cannot be confirmed or claim known payment. Their payment stays unknown.
- A positive or negative payment assertion on an existing connection requires confirmed evidence, even if the wider interpretation is a hypothesis.
- A confirmed Pays for connection requires payment yes; Pays for cannot state payment no.
- Needs to operate is essential; Needs to grow is optional.
- Could benefit from stays potential.
- Partnership and competition require two organisation/product nodes, rather than arbitrary concept nodes.
- Potential and otherwise unconfirmed connections require explicit evidence gaps.
- Self-connections, missing endpoints and unsupported provenance are rejected.

These checks constrain the record. They cannot decide whether an integration announcement proves a contract, or whether your hypothesis would be commercially valuable.

## Existing relationships and corrections

Original relationship records appear as read-only graph projections. Their original type is preserved. An integration remains an integration; technical compatibility is not converted into a partnership, essential dependency, supplier or paying customer. The arrow follows the original A-to-B record ordering and adds no new economic claim.

For a mistaken manually recorded graph edge, inspect it, enter a **Reason for retraction**, then retract it. The active map stops displaying the edge while its record, source and audit events remain available in Research history. Create the corrected connection separately. The API also supports atomic supersession with `supersedes_id`; a dedicated revision editor is not part of this interface yet.

The graph is a research record, not an assertion that every line you have entered is true forever.

## Illustration and live research

**My research** displays your saved records and read-only documented relationship projections.

**Illustrative example** is a generic, client-only demonstration of recursive navigation through Liquidity, Developers, Distribution and related concepts. It is explicitly hypothetical, contains no verified contractual relationship or payment, and never enters SQLite. It is not a factual map of Particle Network or any other real company. Switching back to My research returns to your records.

The original Binance/CoinGecko extraction status is unchanged: this environment blocked the official API hosts before upstream responses were received. The illustration does not substitute for the missing live asset universe. Consult [QUALITY_REPORT.md](QUALITY_REPORT.md) for the observed result.

## Scope and limits

SQLite stores the graph; React Flow draws it. A graph response returns the chosen node’s immediate filtered neighbourhood, with limits of 500 nodes, 500 connections, 5,000 catalogue entries and 100 historical edges. Totals/truncation flags describe bounded results. The canvas displays at most 40 nodes and tells you to use the centre selector and connection list to explore further. A large bounded view is not an exhaustive industry map.

No LLM, document-analysis service, background reasoning engine, automatic company matcher or opportunity recommendation engine is running. No model API key or paid graph database is required. A later model integration could extract proposed functions and suggest editable, source-linked hypotheses, but those proposals would still need the same economic explanation, explicit uncertainty and real-world validation before being treated as opportunities.
