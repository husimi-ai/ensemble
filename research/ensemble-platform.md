# Ensemble (husimi.ai) — Technical Design
# Started: 2026-07-22
# Source vision: notes/ensemble-platform.md

## Brief
Ensemble is a **medical-first research venture studio** platform. Frontend foundation
already exists (Next.js 14.2 App Router, React 18.3, Tailwind v3, TS, pnpm — a light-theme
ChatGPT-style UI clone, frontend-only, no backend/DB/auth/realtime/AI yet). This doc
decides the technical design to turn that into the product: AI-investigated onboarding →
profile → LLM role-classification → apply → LLM-assembled balanced 3-role teams (confirm to
launch) → multi-user AI-augmented group chat → paper+codebase output → publication handoff.
Founder (moussa@husimi.ai) is in every room; compute/data are sidebar requests; data
requests can be published for provider-matching.

**Technical questions this doc resolves (from the vision's Questions for Research):**
- T1 Profile ingestion: turn a person's public footprint (CV, Scholar, LinkedIn, URLs) into
  a durable, queryable profile — the RAG/store design.
- T2 Role-classification (problem-identifier / builder / researcher) from a profile.
- T3 Matching/recommendation engine across 3 surfaces (person→problem, group→specialist,
  data-request→provider) with role/domain/data/proximity signals.
- T4 Balanced-team assembly from an applicant pool; handle thin/lopsided pools.
- T5 In-chat AI: launch + return research, generate work-guides, as first-class chat actions.
- T6 In-room specialist-finder mechanism.
- (+ emergent: realtime chat backbone, auth, persistence, hosting, EU/medical compliance.)

## Recommended Technical Design

**One Postgres, one app, two AI runtimes, one occasional Python worker.**

Build on the **existing Next.js 14 / React 18 / Tailwind v3 / TS** frontend (keep the design
system + primitives; generalize the single-user chat model first). Add **Supabase in EU-Frankfurt**
as the entire backbone — **Postgres** (relational domain + pgvector matching), **Realtime**
(multi-user chat + presence), **Auth** (`@supabase/ssr`), **Storage** (files) — one vendor,
Apache-2.0, self-hostable, with a SOC2 + HIPAA-BAA path for when PHI appears.

**Onboarding** investigates the person from **open scholarly sources** (OpenAlex CC0 + ORCID +
Europe PMC + Crossref) plus an LLM CV parse — never scraping LinkedIn (OIDC/self-export only) —
resolves identity with an **"Is this you?" step**, LLM-stitches a provenance-tagged profile, and
ends on a **mandatory show-and-correct screen** (GDPR Art. 14/16). An LLM then classifies the
**role** (identifier/builder/researcher, contestable).

**Matching** is one 3-stage hybrid engine in Postgres (SQL filter → vector+FTS RRF with a bounded
proximity boost → Cohere rerank) reused across all three surfaces (person→problem, group→specialist,
data→provider). **Team assembly** is **OR-Tools CP-SAT** in a small Python worker, forming
role-complete teams and firing the specialist-matcher to widen thin pools; teams **confirm** before
a room opens (C10).

**The room** is the hero: multi-human realtime chat with a **shared, context-aware AI participant**.
Chat + tools run through the **Vercel AI SDK** in a Node route handler, streaming the AI's reply over
the room's Realtime channel; humans are speaker-labelled `user` turns with an aggressively **cached
prompt prefix**; the AI is **@-summoned** (no model call otherwise). Heavy **`launch_research`** jobs
run in a **background worker on the Claude Agent SDK** (parallel web-search subagents, budget-capped),
posting a cited synthesis back into the thread. `find_specialist`, `request_compute`, and
`request_data` are AI tools that hit the internal API, human-approved. Model routing: **Haiku 4.5**
gate · **Sonnet 5** chat · **Opus 4.8** research + paper drafting.

**Endgame:** a team submits a **version (paper + codebase)**; husimi reviews in an operator console,
co-authors, and readies it for publication (C13/C14). The founder (moussa@husimi.ai) is a member of
every room (C17).

**The only non-Next.js/Postgres pieces:** two API calls (embeddings, rerank), one Python OR-Tools
worker (occasional), and one Node research worker (Agent SDK). Everything else is one app on one DB.

## Decisions

### T1: Profile ingestion = scholarly-first, consent-anchored, user-in-the-loop
**Decision:** Build the profile from **first-party + open scholarly** sources, never scraping.
Sources: **OpenAlex** (CC0 — primary: disambiguated author, works, topics/concepts, co-authors,
institutions, citations/h-index), **ORCID Public API** (authoritative identity anchor: employment,
education, funding), **Europe PMC** (medical depth: PubMed + preprints + **MeSH** + trial links),
**Crossref** (DOI/funding cross-check). CV parsed by the **LLM** into a fixed profile schema.
**Pipeline:** collect user's URLs/CV/answers → resolve identity (ORCID if given, else OpenAlex/
Crossref name+institution search) → **"Is this you?" disambiguation** (user picks the right author
profile — resolves ambiguity *and* serves as consent) → enrich from the confirmed anchor → **LLM
stitch** into the schema with **per-field provenance + confidence** (infers *research domain +
resources controlled*, never personal health) → **mandatory show-and-correct screen** (every field
editable, source-tagged).
**LinkedIn:** never scraped. Only via **"Sign in with LinkedIn" (OIDC)** — yields id/name/email/
photo only — or a **user-uploaded LinkedIn export** parsed by the LLM. Google Scholar (SerpAPI)
is optional/redundant with OpenAlex.
**Why:** Richer, cheaper, and GDPR-safe vs any LinkedIn route (F4, F5). The disambiguation +
show-and-correct steps are simultaneously the accuracy mechanism and the GDPR Art. 14/16 mechanism.
**Alternatives rejected:** LinkedIn scraping / Proxycurl-clones / PDL / Coresignal / Bright Data
(legally closed + GDPR liability — F4); `scholarly` lib (ToS/blocking); dedicated resume-parser as
primary (LLM already handles researcher CVs; keep Affinda/Textkernel as fallback only).
**Confidence:** high.

### T2: Role-classification = LLM over the stitched profile, user-confirmable
**Decision:** Assign each user a role (problem-identifier / builder / researcher) via an **LLM
classification pass over the completed profile** (publications + topics → researcher signal; code/
eng/product history → builder; clinical/domain + problem-framing → problem-identifier), emitting a
role **+ confidence + a short rationale**, with secondary-role signals retained. The user **sees and
can contest** the role at the team-accept screen (C10) and on their profile.
**Why:** The rich profile (T1) already carries the signals; an LLM judgment with rationale beats
brittle rules and is cheap (one Haiku/Sonnet call per user). Human-confirmable per the vision (C5/C10).
**Alternatives rejected:** self-declared role (vision rejected — too shallow); hard rule-based
classifier (misses multi-hats like clinician-who-codes). **Confidence:** high.

### T3: Matching engine = one 3-stage hybrid in Postgres, three surfaces
**Decision:** One engine serves all three surfaces (person→problem, group→specialist,
data→provider) — only the query vector + SQL filters change. Store profiles/problems/dataset-
requests as **pgvector** embeddings (1024-dim, HNSW, `halfvec`) in the **same Supabase Postgres**
(pgvector 0.8's **iterative index scans** matter — they prevent HNSW "overfiltering" when you
post-filter by role/city/institution). Pipeline:
1. **Candidate generation (pure SQL):** cheap `WHERE` filter (never on proximity) → **hybrid
   retrieval** = vector similarity + full-text, merged by **Reciprocal Rank Fusion** (hybrid
   materially beats vector-only).
2. **Composite score + bounded proximity boost (same SQL):**
   `score = fit · (1 + λ·proximity)`, `λ≈0.15`, proximity = max over tiers (same facility 1.0 /
   institution 0.8 / city 0.5 / geo-decay) + a small network-closeness term. **Multiplicative,
   bounded → re-orders near-ties only; never a filter** (honors the vision's boost-not-gate, C8).
   Geo via `earthdistance`/PostGIS; network closeness from a precomputed shared-rooms graph.
3. **Rerank the shortlist:** top ~20–50 → **Cohere Rerank 3.5** (cross-encoder; matches/beats LLM
   rerankers at a fraction of latency/cost). Reserve an actual LLM only for a human-readable
   "why this match" on the final top-5.
**Embeddings:** **Voyage-3.5** primary ($0.06/1M, 200M free) or **OpenAI text-embedding-3-large**
as the one-vendor fallback. **Not** a medical embedder — profiles are scientific prose, and general
top-tier models match/beat domain models here (MedCPT kept as an optional later A/B only).
**Surfaces (a) and (c) are pure SQL** (`supabase.rpc()`), backable by a periodically-refreshed
materialized view for the feed; rerank runs live on load.
**Why:** Keeps everything in the one Postgres — no separate vector DB to sync/pay for at a
people-scale corpus (revisit only at ~50–100M vectors). Evidence F7.
**Alternatives rejected:** Qdrant/Weaviate/Pinecone (second datastore, only pays off at far larger
scale); medical embedders (no quality win on this text + GPU ops); LLM as scorer/reranker (2–5s,
~9× cost, non-deterministic). **Confidence:** high.

### T4: Balanced-team assembly = OR-Tools CP-SAT, thin pools trigger the widen path
**Decision:** Model role-complete team formation as a **constrained assignment / covering ILP** and
solve with **OR-Tools CP-SAT** (Apache-2.0): binary `x[person, team, role]`; each person on ≤1 team;
each team must cover all three roles (≥1 each); team size in `[min,max]`; **let the number of teams
be free and maximize the count of role-complete teams**, objective weighted by `fit + λ·proximity`.
Exact and instant at Ensemble's scale (dozens–low-hundreds of applicants, a handful of teams).
Leftover applicants → waitlist (C16). Runs **occasionally** (when a problem's pool is ready), not
per request, in a **small Python worker** (the only Python in the stack) exposing `POST /assemble`,
reading the pool + precomputed fit/proximity from Postgres.
**Thin/lopsided pools** (e.g. 8 builders, 0 researchers): a `COUNT(*) GROUP BY role` precheck (or a
CP-SAT INFEASIBLE result) is the signal → **(1) wait** (hold, keep pool open); **(2) notify/widen** —
fire the **group→specialist matcher (T3, surface b)** to rank + invite the missing role; **(3) relax
gracefully** — form fewer complete teams, or let a dual-qualified applicant cover two roles via an
eligibility constraint. This is why assembly and specialist-finding share one engine.
**Why:** The all-three-roles rule is a covering constraint over groups that bipartite matching can't
express; CP-SAT handles it exactly with no external solver binary.
**Alternatives rejected:** bipartite matching / `linear_sum_assignment` (optimal 1:1 only — but it
*is* the right tool for surface (b) assigning several specialists to several rooms at once); greedy
(fast fallback, can't jointly optimize — keep as CP-SAT fallback); LLM grouping (can't guarantee the
constraint, not auditable — use only to *explain* a team CP-SAT produced); PuLP/CBC (works; CP-SAT
faster on boolean covering). **Confidence:** high.

### T5: In-chat AI = two runtimes (AI SDK chat + Claude Agent SDK research worker)
**Decision:** Split the AI into **two runtimes over one Postgres thread store**:
1. **Chat/streaming** — **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) in a Next.js **Node**
   route handler (`runtime = 'nodejs'`): `streamText` on the summoned turn, `useChat` on the
   client, tools with Zod `inputSchema`. The AI streams its reply through the room's realtime
   channel (F3) and the final turn is persisted in `onFinish`.
2. **Deep research** — the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) in a
   **background worker** (never a route handler — serverless caps kill multi-minute runs). The
   `launch_research` tool enqueues a job (**pg-boss** on the same Postgres) and returns a
   `job_id` immediately; the worker runs `query()` with **parallel subagents** using built-in
   `WebSearch`/`WebFetch`, bounded by **`maxBudgetUsd`/`maxTurns`**, writing progress to a
   `research_jobs` table; the cited synthesis posts back as an assistant message. Work-guide and
   paper drafting reuse this path.
**Shared multi-user context:** the Messages API has only user/assistant roles, so map **every
human to `role:"user"` with an in-band speaker label** (`"[Alice, cardiologist]: …"`) and the
AI's own turns to `role:"assistant"`; load the whole thread from Postgres on summon. **Prompt
caching** is the main cost lever (same prefix re-sent every summon): freeze system prompt +
tool defs + older history as the cached prefix, keep the newest turn uncached, deterministic
tool-JSON order, no timestamps/IDs in the prefix.
**@-summon gating** happens in the route handler, not the model: non-summoning messages are
only persisted + broadcast (no model call); the model fires only on @mention / explicit action.
**Model routing:** **Haiku 4.5** (`claude-haiku-4-5`, $1/$5) for the @-gate/intent classify;
**Sonnet 5** (`claude-sonnet-5`, $3/$15) for the main chat turn; **Opus 4.8** (`claude-opus-4-8`,
$5/$25, 1M ctx) for research synthesis + paper drafting. One model per thread (caches are
model-scoped); use a cheaper subagent for sub-tasks.
**Why:** AI SDK ships the chat/tool/stream plumbing; the Agent SDK ships the fan-out→verify→
synthesize research loop (subagents + web tools + budget caps) out of the box (F6). Claude-native
end-to-end — no LangChain/Mastra abstraction to fight.
**Alternatives rejected:** roll-your-own chat with the raw Anthropic SDK (rebuilds `useChat`/SSE/
tool-loop — keep raw SDK only for the one-shot gate classifier); Mastra / LangChain.js (needless
abstraction for a Claude-only app); LangGraph.js (strong durable graphs but you'd hand-build every
fan-out/verify node the Agent SDK gives free — pick only if you need a provider-agnostic graph);
Managed Agents (beta — escape hatch if you'd rather not run a worker); running research in a route
handler (serverless duration cap). Durable job runner: **pg-boss** (lowest friction on existing
Postgres); Inngest/Trigger.dev/Vercel Workflows if managed durability is wanted later.
**Confidence:** high (architecture); medium on exact SDK major version — **pin at build time**
(AI SDK was iterating fast: v5 Jul-2025 → v7 mid-2026 per findings).

### T6: Specialist-finder = an AI tool hitting the internal matching API, human-approved
**Decision:** "Find us a specialist" is a first-class **`find_specialist` tool** the chat AI calls;
its `execute` hits the internal matching API (T3, group→specialist surface), returns ranked
candidates rendered as a rich in-room UI block. Actually inviting a candidate is **human-approved**
(`needsApproval`) — the AI proposes, a member confirms, mirroring team-accept (C10). Compute/data
asks are sibling tools (`request_compute` / `request_data`) that post to the operator queue.
**Why:** Reuses the one matching engine (C3) as a tool; keeps side-effectful/medical actions behind
a human gate. **Alternatives rejected:** a separate bespoke recruiting flow (redundant with T3);
auto-inviting without approval (unsafe, low buy-in). **Confidence:** high.

### T7: Backbone = Supabase (single vendor), EU Frankfurt region
**Decision:** Use **Supabase** as the entire backbone — Postgres (relational domain model),
**pgvector** (matching), **Realtime** (multi-user chat + presence), **Auth** via `@supabase/ssr`,
**Storage** (file/content sharing) — provisioned in **`eu-central-1` (Frankfurt)** for GDPR
residency. AI generation is **composed** on top with the Vercel AI SDK (see T5). One vendor
instead of four; Apache-2.0 + self-hostable as the "don't repaint later" escape hatch; the only
all-in-one here with a SOC 2 Type 2 + HIPAA-BAA path (needed once PHI appears).
**Why:** A solo founder can wire one managed Postgres that already carries every requirement
(F2). pgvector lives in the same DB as the relational data, so matching needs no separate vector
store. Region is chosen once at project creation and is effectively permanent — decide now.
**Alternatives rejected:** Convex (best chat DX but **Cloud is US-only; EU residency unshipped**
— GDPR blocker for a medical EU app); Firebase (NoSQL misfits the relational problems/projects/
matching model; vector is a bolt-on; deep lock-in); composed Neon + Ably/Pusher/Liveblocks +
Auth.js/Clerk (best-in-class per layer but a 4-vendor integration/DPA/maintenance tax now — kept
as a **later graft onto the same Postgres schema**, not a day-one cost); Postgres LISTEN/NOTIFY
(no browser reach, no presence — rebuilds what Realtime gives); Lucia (deprecated Mar 2025).
**Confidence:** high.

**AMENDED 2026-07-22 (user decision): self-hosted Supabase on our own GCP project.**
We keep the Supabase *stack* (Postgres + pgvector + GoTrue auth + Realtime + Storage + PostgREST)
but run it **ourselves on Google Cloud** rather than on Supabase's hosted cloud — the database and
all data live in our own GCP project (EU region, e.g. `europe-west4`), managed from Google Cloud
Console. This is the Apache-2.0 self-host escape hatch this decision explicitly reserved.
**Why this over going GCP-native:** the app's coupling to Supabase is small in TypeScript (13 of 146
files) but deep in **authorization** — 45 RLS policies, 21 of which call `auth.uid()`. Dropping
Supabase Auth would force all 45 policies to be re-implemented as application-level authorization,
plus new auth, realtime and storage. Self-hosting keeps every file, policy, channel and bucket
working unchanged; it is infra work, not an application rewrite.
**Rejected:** full GCP-native (Cloud SQL + Identity Platform + GCS + a new realtime layer) — correct
only if the goal is to be free of Supabase's codebase; costs a foundation-and-room rebuild.
**Deployment shape:** Postgres on Cloud SQL (or a VM) + the Supabase services on Cloud Run/GKE, same
migrations, same env var names (only the URL/keys change).

## Stack & Libraries

| Layer | Choice | Call | Version / cost | License / health | Notes |
|---|---|---|---|---|---|
| Frontend | **Next.js 14.2 / React 18.3 / Tailwind 3.4 / TS 5.6** (existing) | Adopt | in repo | MIT | Keep design system + primitives (F1) |
| Backbone | **Supabase** — Postgres + Realtime + Auth + Storage | Adopt | Free→Pro $25/mo | Apache-2.0, self-hostable; SOC2+HIPAA path | Region **eu-central-1**, permanent (F2) |
| Auth glue | **`@supabase/ssr`** + `middleware.ts` | Adopt | current | — | NOT deprecated `auth-helpers`; service-role server-only |
| Vector store | **pgvector 0.8** (in the same Postgres) | Adopt | free | PostgreSQL lic | 1024-dim, HNSW, `halfvec`, iterative scan (F7) |
| Embeddings | **Voyage-3.5** (primary) / OpenAI `text-embedding-3-large` (fallback) | Adopt | $0.06 / $0.13 per 1M | proprietary API | Not a medical embedder (F7) |
| Text search | Postgres **FTS** (`tsvector`) + **RRF** fusion | Compose | free | — | Hybrid ~62%→84% precision (F7) |
| Reranker | **Cohere Rerank 3.5** | Adopt | $2 / 1k searches | proprietary API | top-20–50 shortlist only |
| Proximity | **earthdistance**/PostGIS + network-closeness graph | Compose | free | GPL/PG | bounded boost λ≈0.15, never a filter |
| Team assembly | **OR-Tools CP-SAT** (Python worker) | Adopt | free | Apache-2.0 | covering ILP; exact at this scale (F7) |
| Chat AI | **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) | Adopt | free lib | MIT | `streamText`/`useChat`; **pin major at build** |
| Research AI | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Adopt | free lib | — | subagents + built-in WebSearch/WebFetch, budget caps |
| Job queue | **pg-boss** (on existing Postgres) | Adopt | free | MIT | research + assemble jobs; Inngest/Trigger.dev if managed later |
| Models | **Haiku 4.5** `claude-haiku-4-5` · **Sonnet 5** `claude-sonnet-5` · **Opus 4.8** `claude-opus-4-8` | Adopt | $1/$5 · $3/$15 · $5/$25 per MTok | Anthropic | gate · chat · research/paper; prompt-cache the prefix |
| Scholarly data | **OpenAlex** (CC0) · **ORCID** · **Europe PMC** · **Crossref** | Adopt | free | CC0 / open | profile ingestion (T1); set `mailto`/UA, cache by author-ID |
| CV / LinkedIn | LLM CV parse; LinkedIn via **OIDC** or user export only | Build/Adopt | — | — | never scrape (F4); Affinda fallback if LLM CV weak |

**Language footprint:** TypeScript everywhere except **one Python service** (OR-Tools CP-SAT). The
Agent SDK research worker is Node/TS. Two external API deps (embeddings, rerank).

## Architecture

### Domain model (entities & flows) — backbone-agnostic first pass
Derived directly from the vision; concrete DB/tech binding follows the backbone decision (T-backbone).

**Core entities**
- **User** — account/auth: id, email, name, profession, city, institution(s).
- **Profile** (1:1 User) — the investigated picture: extracted research topics, publications,
  skills, role signals, institution, city, *data/resources they may control*; one or more
  **embeddings**; assigned **role** (problem-identifier / builder / researcher) + confidence;
  `confirmed` flag. Every inferred fact carries **provenance** (which source) for GDPR review.
- **ProfileSource** — each provided link/CV and what was fetched (OpenAlex/ORCID/CV-parse…),
  for provenance + re-ingest.
- **Problem** — a listing: title, description, medical subfield/tags, required roles/skills,
  `origin` (founder-seeded | user-submitted), `submitted_by`, `status` (draft→review→published).
- **Application** — User → Problem: role (as classified), `status` (pending|assembled|
  unmatched), `feedback` (fuels the unmatched-retry loop, C16).
- **Group** (a.k.a. Project / Ensemble) — a formed team on a Problem: `status`
  (proposed→confirming→active→submitted→handed-over). (Many groups may tackle one problem.)
- **Membership** — User ↔ Group with `role` (problem/builder/researcher/**provider**/**founder**)
  and `accepted` (C10 unanimous accept). Founder is a member of every group (C17); accepted
  data-providers/specialists join as members (C15).
- **Message** — in a Group room: sender (user *or* AI), content, attachments, `kind`
  (human|ai|system|research-result|work-guide). Realtime-delivered.
- **AiTask** — a summoned AI action in a room: `type` (answer|research|work-guide|
  find-specialist), `status` (running|done), input, streamed/stored result. Research =
  long-running (needs a job runner, see T5).
- **ResourceRequest** — compute|data ask from a Group: description, `status`
  (requested|fulfilled|published). Routes to the operator console; a data request can be
  **published** → DataRequestListing.
- **DataRequestListing** + **ProviderApplication** — published data need, ranked to likely
  providers (C12); a provider "applies to help" → on accept becomes a Membership.
- **Version** — a Group's submitted paper+codebase: paper ref, repo ref, `status`
  (submitted→feedback→taken-over→published), iterative `version_no` (C13/C14).
- **Operator queue** — a founder-only view over pending Problem submissions, ResourceRequests,
  and Versions (likely a query/view, not its own table).

**Flow → surface map**
- Onboarding → profile-investigation pipeline (T1) → **profile review** screen (edit/confirm).
- **Home feed** → Problems ranked person→problem (T3) → **Apply**.
- **Team assembly** batch job (T4) → proposed Group + pending Memberships → **accept screen**
  (C10, also role-contest) → room goes active.
- **Group room** (hero) → realtime Messages + shared AI participant (T5) + sidebar
  compute/data requests + in-room specialist-finder (T6).
- **Operator console** (founder-only) → fulfil/publish requests, edit/publish problems, review Versions.
- **Version submission** → husimi review → takeover/publication.

### System components & data flow

```
                         ┌─────────────────────────────────────────────┐
   Browser (Next.js) ────┤  Next.js 14 App Router (Vercel, nodejs)      │
   - feed / room / onb.  │   - Server Components + Route Handlers        │
   - useChat (AI SDK)    │   - Server Actions                            │
   - Realtime subscribe  │   - @supabase/ssr (session in middleware)     │
        │      ▲         └───────┬───────────────┬───────────────┬───────┘
        │      │ realtime        │ SQL/RPC       │ tool.execute  │ enqueue
        │      │ (broadcast)     ▼               ▼               ▼
        │  ┌───┴─────────────────────────────────────────┐  ┌───────────────┐
        └──┤  Supabase (EU-Frankfurt)                     │  │ pg-boss queue │
           │   Postgres: domain tables + pgvector(HNSW)   │  │ (in Postgres) │
           │   Realtime: 1 channel/room + presence (RLS)  │  └───┬───────┬───┘
           │   Auth (GoTrue) · Storage (RLS buckets)      │      │       │
           └───────┬──────────────────────┬───────────────┘      │       │
                   │ embeddings/rerank     │ read pool            │       │
                   ▼                       ▼                      ▼       ▼
        ┌──────────────────┐   ┌────────────────────┐   ┌────────────┐ ┌───────────────┐
        │ Voyage / OpenAI  │   │ Python worker      │   │ Node worker│ │ Chat model    │
        │ + Cohere Rerank  │   │ OR-Tools CP-SAT    │   │ Agent SDK  │ │ call (AI SDK) │
        │ (embed + rank)   │   │ POST /assemble     │   │ research   │ │ Anthropic     │
        └──────────────────┘   └────────────────────┘   └─────┬──────┘ └───────┬───────┘
                                                              │ web search     │ stream
                                                              ▼                ▼
                                                        WebSearch/Fetch   room channel
```

**Key data flows**
- **Onboarding →** Server Action collects links/CV → calls scholarly APIs + LLM stitch → writes
  `Profile` (+ provenance) → embeds (Voyage) into pgvector → LLM role-classify → show-and-correct.
- **Feed →** `supabase.rpc()` runs the 3-stage hybrid (SQL filter → RRF → proximity boost) →
  Cohere rerank server-side → ranked `Problem`s. Backed by a refreshed materialized view.
- **Apply → assemble →** applications accumulate; when a pool is ready, enqueue an assemble job →
  Python CP-SAT worker reads pool + fit/proximity → returns role-complete teams (or INFEASIBLE →
  widen via specialist matcher) → creates `Group` + pending `Membership`s → members **accept** (C10)
  → room opens (founder auto-added, C17).
- **Room chat →** human message: persisted + broadcast over the room's Realtime channel, **no model
  call** unless the AI is @-summoned. Summon → chat Route Handler loads thread from Postgres, builds
  speaker-labelled `messages` with a cached prefix, `streamText` → deltas relayed to the room
  channel (every participant renders the same stream) → final turn persisted `onFinish`.
- **launch_research →** tool enqueues a pg-boss job, returns `job_id`; Node Agent-SDK worker fans out
  budget-capped web-search subagents, writes progress to `research_jobs`, posts the cited synthesis
  as an assistant message; clients reconnect via a resumable channel keyed by `job_id`.
- **find_specialist / request_compute / request_data →** AI tools calling the internal API;
  side-effects (invite, provision) are **human-approved** and land in the operator queue.
- **Version submit →** `Version` row + Storage refs → operator console → husimi feedback → takeover.

**Realtime & security:** one multiplexed channel **per room** (watch the 200/500 concurrent-conn
ceiling); **RLS** on every table; **Realtime Broadcast Authorization** so only room members subscribe;
service-role key server-only. The AI's human↔human fan-out is Realtime; the AI's own token stream is
relayed onto the same channel (the AI SDK's default SSE goes only to the requester — must be relayed).

## Decisions Made For You (override in /refine)

- **Embeddings = Voyage-3.5.** Best price/quality ($0.06/1M). _Change to OpenAI
  `text-embedding-3-large` if you'd rather keep one AI vendor/SDK, or BGE-M3 self-host if you later
  need zero per-token cost / on-prem._
- **Job queue = pg-boss** (on the existing Postgres). Zero extra infra. _Change to Inngest or
  Trigger.dev if you want managed durability, retries dashboards, and observability out of the box._
- **Hosting = Vercel for the Next app; the two workers (Python OR-Tools, Node Agent-SDK) on a small
  always-available service** (Fly.io / Render / Cloud Run). _Change the worker host, or fold research
  into Claude Managed Agents (beta) to avoid running a worker at all._
- **@-summon default = explicit @mention / "Ask AI" button** (no model call otherwise). _Change to an
  ambient Haiku "should the AI chime in?" classifier if you want the AI to volunteer — costs more._
- **Chat model = Sonnet 5.** Near-Opus quality at $3/$15. _Change to Opus 4.8 for maximum quality per
  turn (higher cost), or keep Sonnet and reserve Opus for research/paper drafting (current default)._
- **Reranker = Cohere Rerank 3.5 from day one.** _Change to "defer rerank until the feed has depth"
  (Stages 1–2 alone are serviceable early) to drop one paid dependency in the MVP._
- **CV parsing = the chat LLM** against the profile schema. _Change to Affinda/Textkernel only if LLM
  accuracy on messy multi-column CVs proves insufficient._
- **LinkedIn = offer "Sign in with LinkedIn" (OIDC) + accept user export.** _Change to skipping
  LinkedIn entirely (scholarly sources already carry the profile) if you want a smaller auth surface._
- **Research engine = self-hosted Claude Agent SDK worker.** _Change to Claude Managed Agents (beta)
  to offload the loop + sandbox + cron to Anthropic._

## Key Findings

### F1: The existing app is a reusable presentational shell over a single-user chat model
**Finding:** Frontend-only. All state lives in `app/page.tsx` (`useState`), `send()` returns a
hardcoded canned string — no fetch/stream/persistence anywhere. Verified absent (by grep): any
`app/api/`, DB, auth, realtime, AI SDK, data-fetching, env usage, client storage. The message
model in `lib/types.ts` is single-user ChatGPT semantics: `Role = "user" | "assistant"`;
`ChatMessage { id, role, content }` — **no sender identity, name, timestamp, or room id.**
**Evidence:** Agent codebase sweep of every source file. Reusable as-is: `Composer`, `Modal`,
`IconButton`, `Toggle`, `SettingRow`/`SelectControl`, `icons`, `EmptyState`, `Suggestions`,
and the `SettingsModal` tabbed shell (drop the 14 ChatGPT tabs). Needs rework for multi-user:
`lib/types.ts` (root cause), `Message` (binary user/assistant alignment), `MessageActions`
(ChatGPT-specific), `Thread` (typed to `ChatMessage`), `Sidebar`/`AccountMenu` (hardcoded
data), `ModelSwitcher`, and `page.tsx` (canned `send`, all-local state, single static route).
**Implications:** (1) Keep the design system + primitives — big head start, honors CLAUDE.md.
(2) **First build step is the data model**: generalize `Message` to a multi-author room model
(`senderId`, `senderKind: human|ai|system`, `roomId`, `kind`, `createdAt`, attachments) — the
`Thread`/`Message`/`MessageActions` rework all follow from it. (3) The app must gain routing
(rooms, feed, onboarding, operator console), providers (auth/realtime/data), and server routes;
today it's one client route. (4) `ModelSwitcher` is repurposable as an AI-participant/model
control in a room, or dropped.

### F2: One Supabase Postgres covers every backend need; EU residency rules out Convex
**Finding:** For a solo founder, Supabase (Postgres + pgvector + Realtime + Auth + Storage) meets
the entire requirement set in one vendor. Convex has the best chat DX but **Cloud is US-only, EU
residency unshipped** — a GDPR blocker for a medical EU app; Firebase's NoSQL misfits the relational
model; the composed 4-vendor stack is a maintenance/DPA tax now (Neon is Databricks-owned, PartyKit
absorbed by Cloudflare, Lucia deprecated Mar 2025).
**Evidence:** Supabase Free = 200 concurrent Realtime conns / 50k MAU / 500MB DB; Pro $25 = 500 conns.
EU regions Frankfurt/Ireland; SOC2 Type 2 + HIPAA via BAA add-on; Apache-2.0 self-hostable.
**Implications:** Provision `eu-central-1` on day one (permanent). Pro for MVP; HIPAA BAA + Team plan
only once real PHI lands (the data-matching design mostly keeps husimi from holding PHI, C12). First
scaling limit is Realtime concurrency → one channel per room.

### F3: Multi-user AI streaming must be relayed over the room channel, not the default SSE
**Finding:** The Vercel AI SDK's default transport streams the AI reply over SSE **to only the
requester** — wrong for a shared room. The AI's token stream must be relayed onto the room's Supabase
Realtime channel; the final message persists to Postgres; all clients render from the channel.
**Evidence:** AI SDK transport docs; Supabase Broadcast docs; a custom `ChatTransport` can read the
channel so `useChat` still drives the UI.
**Implications:** The room's realtime layer carries both human↔human messages and the AI's relayed
stream. Enable Realtime Broadcast Authorization (RLS) so only members subscribe.

### F4: LinkedIn data is legally closed; take it only from the user's own hands
**Finding:** Scraping LinkedIn is enforceable breach-of-contract (how LinkedIn beat hiQ — $500k,
injunction, hiQ shut down). **Proxycurl was sued (Jan 2025) and shut down (~Jul 2025)** with an order
to delete all data. Buying pre-scraped person data (PDL/Coresignal/Bright Data) makes *you* a GDPR
controller who acquired EU personal data without a legal basis or Art. 14 notice. US scraping wins
(Meta v. Bright Data) are CFAA/contract holdings, irrelevant to GDPR.
**Evidence:** Morgan Lewis (hiQ); nubela.co (Proxycurl shutdown); Farella (Meta v. Bright Data); CNIL
legitimate-interest sheet (Jun 2025); gdpr-info Art. 14.
**Implications:** LinkedIn only via **"Sign in with LinkedIn" OIDC** (id/name/email/photo only) or a
**user-uploaded export**. The rich profile comes from scholarly APIs instead.

### F5: Open scholarly APIs give a richer, cheaper, GDPR-safe medical-researcher profile
**Finding:** OpenAlex (CC0 — works, topics, co-authors, metrics), ORCID (authoritative identity),
Europe PMC (medical depth + MeSH + trials), Crossref (DOI/funding) together beat any LinkedIn route.
All free REST-JSON, fit an onboarding flow within free tiers. The **"Is this you?" disambiguation** +
**show-and-correct** screen simultaneously fix accuracy and satisfy GDPR Art. 14/16.
**Evidence:** developers.openalex.org (CC0; 2026 free API key ~$1/day); ORCID API (12 req/s); Europe PMC
(~10 req/s, no key); Crossref REST (polite pool). Medical = special category (Art. 9) → infer research
domain/resources, never personal health.
**Implications:** Deterministic profiles keyed by ORCID/OpenAlex author ID; store source+confidence per
field; publish an Art. 14 notice; CV parsed by the LLM (Affinda fallback only if weak).

### F6: Chat and deep-research are different runtimes; keep both Claude-native
**Finding:** Chat/streaming belongs in a Next.js Node route handler on the Vercel AI SDK; long
multi-minute research belongs in a **background worker on the Claude Agent SDK** (parallel subagents +
built-in WebSearch/WebFetch + `maxBudgetUsd`/`maxTurns` + resumable sessions) — never a serverless route
(duration cap). Shared multi-user context = map each human to a speaker-labelled `user` turn;
**prompt-cache the stable prefix** (biggest cost lever in a re-summoned thread).
**Evidence:** Claude Agent SDK TS reference; Vercel AI SDK blogs; prompt-caching docs (reads ~0.1×; min
prefix Opus/Haiku 4096, Sonnet 2048; caches model-scoped). Rejected LangGraph/Mastra/roll-your-own as
needless abstraction for a Claude-only app.
**Implications:** Two workers (Node research, Python assemble) + the app. @-summon gating and caching
are the two dominant cost controls. Pin the AI SDK major at build time (fast-moving).

### F7: Matching + assembly stay in Postgres; CP-SAT handles the role constraint exactly
**Finding:** A 3-stage hybrid (SQL filter → vector+FTS RRF → Cohere rerank) with a **bounded
multiplicative proximity boost** serves all three matching surfaces from one pgvector-in-Postgres store;
no dedicated vector DB pays off below ~50–100M vectors. Balanced role-complete team formation is NP-hard
but **OR-Tools CP-SAT** solves it exactly at Ensemble's scale; thin pools surface as INFEASIBLE → widen
via the shared specialist matcher.
**Evidence:** pgvector 0.8 iterative scan; Supabase hybrid RRF (~62%→84% precision); Cohere Rerank 3.5
($2/1k); Voyage-3.5 ($0.06/1M, within 0.3% of Cohere-v4); OR-Tools assignment-teams; team-formation
NP-hardness (arXiv 1505.06661); domain-embedding study (arXiv 2409.18511).
**Implications:** Two API deps (embed, rerank) + one occasional Python worker. Proximity is a tunable
boost (λ), never a filter. Weights `w1..w4`, λ, role taxonomy, and thin-pool policy are product logic to
tune on real feedback.

## References
### R1: Supabase — pricing, regions, realtime, compliance
**Source:** https://supabase.com/pricing · https://supabase.com/docs/guides/platform/regions ·
https://supabase.com/docs/guides/realtime/broadcast · https://supabase.com/blog/supabase-soc2-hipaa
**Takeaway:** All-in-one Postgres backbone; EU Frankfurt region; Realtime Broadcast/Presence with RLS
authorization; SOC2 Type 2 + HIPAA-BAA path. Free→$25 Pro; Apache-2.0 self-hostable.

### R2: pgvector 0.8 + hybrid search + rerank
**Source:** https://www.postgresql.org/about/news/pgvector-080-released-2952 ·
https://supabase.com/docs/guides/ai/hybrid-search · https://cohere.com/pricing ·
https://blog.voyageai.com/2025/05/20/voyage-3-5/
**Takeaway:** pgvector 0.8 iterative scans fix filter-then-rank overfiltering; hybrid RRF lifts
precision; Cohere Rerank 3.5 for the shortlist; Voyage-3.5 as the cheap high-quality embedder.

### R3: OR-Tools CP-SAT + team-formation complexity
**Source:** https://developers.google.com/optimization/assignment/assignment_teams ·
https://pypi.org/project/ortools/ · https://arxiv.org/pdf/1505.06661
**Takeaway:** Team formation is NP-hard; CP-SAT (Apache-2.0) solves the role-covering assignment
exactly at small scale; free number of teams, maximize role-complete count.

### R4: Claude Agent SDK + Vercel AI SDK + prompt caching
**Source:** https://code.claude.com/docs/en/agent-sdk/typescript · https://vercel.com/blog/ai-sdk-7 ·
https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md ·
https://platform.claude.com/docs/en/about-claude/models/overview.md
**Takeaway:** Agent SDK for the research loop (subagents, web tools, budget caps); AI SDK for chat/
streaming/tools; cache the stable prompt prefix; Haiku/Sonnet/Opus model routing + current pricing.

### R5: Scholarly profile sources
**Source:** https://developers.openalex.org/ · https://info.orcid.org/ufaqs/what-are-the-api-limits/ ·
https://europepmc.org/RestfulWebService · https://www.crossref.org/documentation/retrieve-metadata/rest-api/
**Takeaway:** OpenAlex (CC0), ORCID, Europe PMC (medical + MeSH), Crossref — free REST profile sources,
richer and safer than LinkedIn.

### R6: LinkedIn/scraping legal + GDPR
**Source:** https://nubela.co/blog/goodbye-proxycurl/ ·
https://www.morganlewis.com/blogs/sourcingatmorganlewis/2022/12/linkedin-v-hiq-landmark-data-scraping-suit-provides-guidance-to-data-scrapers-and-web-operators ·
https://www.cnil.fr/en/legal-basis-legitimate-interest-focus-sheet-measures-implement-case-data-collection-web-scraping ·
https://gdpr-info.eu/art-14-gdpr/
**Takeaway:** LinkedIn scraping and enrichment APIs are legally closed; GDPR Art. 14 obliges
transparency for any non-first-party data. Take LinkedIn only from the user directly.

## Discarded Approaches
These are explicit **non-goals** for the build:
- **LinkedIn scraping / enrichment APIs / bought person-datasets** (Proxycurl clones, PDL, Coresignal,
  Bright Data) — legally closed + GDPR liability (F4).
- **Dedicated vector DB** (Pinecone/Qdrant/Weaviate) — no payoff below ~50–100M vectors; pgvector wins.
- **Medical-specific embedding model** (MedCPT/BioBERT) as primary — general models match/beat it on
  this text + add GPU ops (optional later A/B only).
- **LLM as the matching scorer/reranker** in the hot path — 2–5s, ~9× cost, non-deterministic; LLM only
  for a "why this match" explanation.
- **LangChain.js / Mastra / LangGraph / roll-your-own chat** — needless abstraction for a Claude-only,
  Next-native app (Agent SDK + AI SDK cover it).
- **Convex / Firebase / composed 4-vendor backbone** — EU-residency blocker / NoSQL misfit / vendor tax.
- **Postgres LISTEN/NOTIFY as the realtime layer** — no browser reach, no presence.
- **Bipartite / greedy / LLM as the team-assembly algorithm** — can't express the all-three-roles
  covering constraint (bipartite is kept only for surface-b specialist→rooms; greedy as CP-SAT fallback).
- **Running long research in a serverless route handler** — duration cap kills multi-minute runs.

## Risks & Open Threads
- [x] **Profile review/consent** — resolved: mandatory show-and-correct step is the GDPR Art. 14/16
      mechanism, built into onboarding (T1).
- [ ] **PHI / HIPAA (biggest compliance thread).** The C12 design keeps husimi a *connector*, not a
      data controller — but the actual data transfer between a provider and a group needs a governance /
      DPA design (who holds it, where, under what agreement). MVP: treat data requests as
      provider-matching + operator-mediated introductions only; **defer any husimi-hosted clinical data**
      until Team plan + BAA + a data-governance design exist. Flag for a dedicated later phase.
- [ ] **Realtime concurrency ceiling** (200 Free / 500 Pro conns; one per open tab). Multiplex one
      channel per room; this is the first limit to hit — trigger to consider the composed realtime graft.
- [ ] **AI cost control** depends on @-summon gating + prompt-cache hit rate holding up in a busy room;
      instrument `cache_read_input_tokens` and per-thread spend from day one.
- [ ] **AI SDK version churn** — pin the major at build; the chat layer moved fast (v5→v7 within ~a year).
- [ ] **Author disambiguation edge cases** (common names, no ORCID) — the "Is this you?" step mitigates;
      needs a graceful manual-entry fallback when no confident candidate is found.
- [ ] **Cold-start liquidity** (product, inherited from vision) — matching/assembly quality scales with
      pool size; medical-first focus + founder-seeded problems + concierge mitigate, but it's the core
      go-to-market risk, not a technical one.
- [ ] **Inherited product decisions for /refine** — credit-vs-equity contributor deal, and whether every
      deliverable must be a paper. Not technical; carry to /refine.

## Build Plan
Phased and dependency-ordered so `/readyforlaunch` can map phases to parallel agent groups.

**Phase 0 — Foundations (blocking; everything depends on it).**
Supabase project in `eu-central-1`; enable `vector`, `pg_trgm`/FTS, `cube`+`earthdistance`. Domain
schema + **RLS** (users, profiles, profile_sources, problems, applications, groups, memberships,
messages, resource_requests, data_request_listings, provider_applications, versions, research_jobs,
connections). Auth via `@supabase/ssr` + `middleware.ts`. **Generalize `lib/types.ts`** to the
multi-author room model (`senderId`, `senderKind: human|ai|system`, `roomId`, `kind`, `createdAt`,
attachments) and rework `Message`/`Thread`/`MessageActions`. App routing skeleton (feed / room /
onboarding / profile / operator). Keep all design-system primitives (F1).

**Phase 1 — Onboarding & profile (after P0).**
Scholarly clients (OpenAlex/ORCID/Europe PMC/Crossref) with polite headers + author-ID caching;
LLM CV parse; **"Is this you?" disambiguation**; LLM stitch → provenance-tagged profile schema;
**show-and-correct screen**; embed profile into pgvector (Voyage); **LLM role-classification**;
"Sign in with LinkedIn" (OIDC) + export upload; Art. 14 notice.

**Phase 2 — Matching & assembly (after P1; parallel with P3).**
3-stage hybrid as a Postgres function / `supabase.rpc()` (SQL filter → vector+FTS RRF → proximity
boost) + server-side Cohere rerank; materialized-view home feed; **Python CP-SAT `/assemble` worker**;
apply flow; **team-accept screen** (C10, role-contest); unmatched → feedback → widen (fire specialist
matcher) → retry (C16).

**Phase 3 — The room (after P0 chat model; parallel with P2).**
Multi-user realtime chat (Supabase Realtime channel per room + presence, Broadcast Authorization);
file/content sharing (Storage, RLS buckets); the **AI participant** via the AI SDK chat Route Handler
(`runtime='nodejs'`) — @-summon gating, speaker-labelled + cached context, **stream relayed onto the
room channel** (F3), persist `onFinish`. Founder auto-membership in every room (C17).

**Phase 4 — AI actions (after P2 matching API + P3 room).**
`launch_research` (pg-boss job → **Node Agent-SDK worker**: parallel budget-capped web-search subagents
→ progress in `research_jobs` → cited synthesis posted back, resumable by `job_id`); `find_specialist`,
`request_compute`, `request_data` tools with **human-approval** gates; work-guide drafting (Opus).

**Phase 5 — Operator console & endgame (after P0/P1; parallel with P4).**
Founder-only queue: review/publish problem submissions, fulfil compute/data or **publish a data request**
for provider-matching, review **versions**; version submission (paper + codebase via Storage) →
feedback → takeover (C13/C14).

**Phase 6 — Hardening.**
Cost/caching instrumentation (cache-hit, per-thread spend); GDPR data-subject flows (access/erasure,
provenance); scholarly-API rate-limit + caching; seed founder problems; observability + basic tests.

**Parallelization for `/readyforlaunch`:** P0 is a hard gate. After it, P1 and the P3 chat shell can
proceed together; P2 depends on P1 profiles; P4 depends on P2's matching API + P3's room; P5 can run
alongside P4. The two workers (Python assemble, Node research) are independent deployables.

## Implementation Log
Built via `/flow:readyforlaunch` on 2026-07-22 — 16 tasks across 6 dependency-ordered groups.

- **Execution note:** worktree isolation was unreliable in this environment (4 of the first 6
  agents had their isolation worktrees culled mid-run). Switched to **sequential, no-isolation
  agents writing directly to `main`**; recovered the culled agents' work (one from provided code,
  the rest re-dispatched). All 16 tasks completed, each `tsc --noEmit` clean.
- **Integration:** full typecheck clean (146 source files); `next build` succeeded (**17 routes**);
  the production server boots — `/login` and `/` render, `/feed` correctly redirects to
  `/login?next=/feed`.
- **De-sloppify:** code was already clean (no oversized files, no TODO/dead markers; only
  legitimate worker startup/shutdown logs).
- **Acceptance verdict: YELLOW.** Structurally GREEN (builds, boots, enforces auth); all live flows
  (Supabase data/realtime/sign-in, Anthropic AI, Voyage/Cohere, LinkedIn OIDC, OR-Tools worker) are
  **BLOCKED** pending real credentials + a provisioned Supabase project. No RED failures.
- **Published** as a public prototype: https://github.com/husimi-ai/ensemble (PolyForm
  Noncommercial 1.0.0, © Husimi).
- **To go live (needs credentials/deploy):** provision Supabase `eu-central-1` + apply
  `supabase/migrations/`; set the `.env.example` keys; enable LinkedIn OIDC in Supabase; deploy the
  Python assembly worker (`services/assembly/`) + the Node research worker
  (`services/research/worker.ts`); then run end-to-end runtime acceptance.
