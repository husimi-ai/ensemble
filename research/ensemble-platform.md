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
<!-- filled at wrap-up -->

## Decisions Made For You (override in /refine)
<!-- preference-sensitive picks -->

## Key Findings
<!-- F# logged as agents report -->

## References
<!-- R# -->

## Discarded Approaches
<!-- filled as findings land -->

## Risks & Open Threads
<!-- filled as findings land -->

## Build Plan
<!-- filled at wrap-up -->
