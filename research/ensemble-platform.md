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
