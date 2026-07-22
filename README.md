# Ensemble

> **⚠️ Prototype — not production.** This is an early, clean-room prototype of Husimi's
> **Ensemble** platform. It compiles, builds, and boots, and enforces auth end-to-end, but it
> has **not** been connected to live services or security-reviewed. Interfaces, schema, and
> behavior will change. Do not deploy as-is.

**Ensemble** is a **medical-first research venture studio**: people are matched into balanced
teams around real problems in healthcare, then collaborate in an **AI-augmented group chat** that
can run deep research, find specialists, and produce a paper + codebase — which Husimi reviews and
takes to publication.

## What's here
A full-stack Next.js 14 app on Supabase:

- **Onboarding** that builds a researcher profile from **open scholarly sources**
  (OpenAlex / ORCID / Europe PMC / Crossref) plus an LLM CV parse — never scraping LinkedIn — with
  an "is this you?" step and a GDPR show-and-correct screen.
- **Matching** — one hybrid engine (SQL filter + pgvector + full-text RRF + Cohere rerank, with a
  bounded proximity boost) across three surfaces (person→problem, group→specialist,
  data→provider), and **OR-Tools CP-SAT** balanced-team assembly.
- **The room** — multi-user realtime chat with a shared, `@`-summonable **AI participant**
  (Vercel AI SDK), plus a **Claude Agent SDK** deep-research worker that posts cited syntheses back
  into the thread.
- **Operator console**, compute/data requests (data can be published for provider-matching), and
  **paper + codebase** submission.

## Stack
Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v3 · **Supabase** (Postgres + pgvector +
Realtime + Auth + Storage) · **Vercel AI SDK** + **Claude** (Anthropic) · Voyage embeddings + Cohere
rerank · **OR-Tools** CP-SAT (Python). Design decisions live in `research/ensemble-platform.md`.

## Status
All 17 routes build and typecheck; the app boots and gates protected routes. Live flows (sign-in,
data, AI, matching, realtime) require real credentials and a provisioned Supabase project — see
`.env.example`. This build is not yet wired to any live backend.

## Quick start
```bash
pnpm install
cp .env.example .env.local     # fill in a Supabase project + API keys
pnpm dev                        # http://localhost:3000
```
Apply the SQL in `supabase/migrations/` to a Supabase project (region `eu-central-1`). The Python
team-assembly worker lives in `services/assembly/`; the research worker is
`services/research/worker.ts`.
