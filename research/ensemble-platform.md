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
<!-- filled at wrap-up -->
_(in progress — investigating)_

## Decisions
<!-- one T# per resolved question; filled as findings land -->

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

## Stack & Libraries
<!-- filled as findings land -->

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

_(Stack, realtime, matching internals, and AI orchestration below are pending the five
research agents.)_

## Decisions Made For You (override in /refine)
<!-- preference-sensitive picks -->

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

## References
<!-- R# -->

## Discarded Approaches
<!-- filled as findings land -->

## Risks & Open Threads
<!-- filled as findings land -->

## Build Plan
<!-- filled at wrap-up -->
