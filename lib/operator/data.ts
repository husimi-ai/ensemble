/**
 * Operator console -- server-side queue loaders (RLS-scoped, operator-guarded).
 *
 * Reads the three review queues the founder acts on (spec "Operator queue"):
 *   - pending Problem submissions (draft/review -> publish),
 *   - open ResourceRequests (compute|data -> fulfil / publish a data listing),
 *   - submitted Versions (paper+codebase -> feedback / takeover).
 *
 * Every read passes {@link requireOperator} first; the task-001 RLS policies also
 * scope each table to `is_operator()`, so this is fail-closed twice. Import via
 * `@/lib/operator/data`. Server-only (uses the request-scoped Supabase client).
 */
import type { Problem, ProblemOrigin, ProblemStatus } from "@/lib/types";
import type { ResourceKind, ResourceRequestStatus, VersionStatus } from "@/lib/types";
import { requireOperator } from "./guard";

/** Discriminated result shared by every operator server action. */
export type ActionResult = { ok: true; note?: string } | { error: string };

/** A pending resource request with its group's display name for context. */
export interface OperatorRequest {
  id: string;
  groupId: string;
  groupName: string | null;
  kind: ResourceKind;
  description: string;
  status: ResourceRequestStatus;
  createdAt: string;
}

/** A submitted version with its group's display name for context. */
export interface OperatorVersion {
  id: string;
  groupId: string;
  groupName: string | null;
  versionNo: number;
  paperRef: string | null;
  repoRef: string | null;
  status: VersionStatus;
  feedback: string | null;
  createdAt: string;
}

/** Everything the console renders in one operator-guarded load. */
export interface OperatorQueues {
  problems: Problem[];
  requests: OperatorRequest[];
  versions: OperatorVersion[];
}

const PROBLEM_COLUMNS =
  "id,title,description,subfield,tags,required_roles,required_skills,origin,submitted_by,status,created_at,updated_at";

interface ProblemRow {
  id: string;
  title: string;
  description: string | null;
  subfield: string | null;
  tags: string[] | null;
  required_roles: string[] | null;
  required_skills: string[] | null;
  origin: ProblemOrigin;
  submitted_by: string | null;
  status: ProblemStatus;
  created_at: string;
  updated_at: string;
}

function mapProblem(r: ProblemRow): Problem {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    subfield: r.subfield,
    tags: r.tags ?? [],
    requiredRoles: r.required_roles ?? [],
    requiredSkills: r.required_skills ?? [],
    origin: r.origin,
    submittedBy: r.submitted_by,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Embedded to-one relation arrives as an object (or, defensively, an array). */
function firstOf<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null;
  return (rel as T | null) ?? null;
}

interface RequestRow {
  id: string;
  group_id: string;
  kind: ResourceKind;
  description: string | null;
  status: ResourceRequestStatus;
  created_at: string;
  groups: unknown;
}

interface VersionRow {
  id: string;
  group_id: string;
  version_no: number;
  paper_ref: string | null;
  repo_ref: string | null;
  status: VersionStatus;
  feedback: string | null;
  created_at: string;
  groups: unknown;
}

/**
 * Load the three operator queues in parallel. Pending problems are draft/review;
 * pending requests are requested/fulfilled (not yet published); pending versions
 * are submitted/feedback (not yet taken-over/published). Newest first.
 */
export async function loadOperatorQueues(): Promise<OperatorQueues> {
  const { supabase } = await requireOperator();

  const [problemsRes, requestsRes, versionsRes] = await Promise.all([
    supabase
      .from("problems")
      .select(PROBLEM_COLUMNS)
      .in("status", ["draft", "review"])
      .order("created_at", { ascending: false }),
    supabase
      .from("resource_requests")
      .select("id,group_id,kind,description,status,created_at,groups(name)")
      .in("status", ["requested", "fulfilled"])
      .order("created_at", { ascending: false }),
    supabase
      .from("versions")
      .select("id,group_id,version_no,paper_ref,repo_ref,status,feedback,created_at,groups(name)")
      .in("status", ["submitted", "feedback"])
      .order("created_at", { ascending: false }),
  ]);

  const problems = ((problemsRes.data as ProblemRow[] | null) ?? []).map(mapProblem);

  const requests: OperatorRequest[] = ((requestsRes.data as RequestRow[] | null) ?? []).map(
    (r) => ({
      id: r.id,
      groupId: r.group_id,
      groupName: firstOf<{ name: string | null }>(r.groups)?.name ?? null,
      kind: r.kind,
      description: r.description ?? "",
      status: r.status,
      createdAt: r.created_at,
    }),
  );

  const versions: OperatorVersion[] = ((versionsRes.data as VersionRow[] | null) ?? []).map(
    (v) => ({
      id: v.id,
      groupId: v.group_id,
      groupName: firstOf<{ name: string | null }>(v.groups)?.name ?? null,
      versionNo: v.version_no,
      paperRef: v.paper_ref,
      repoRef: v.repo_ref,
      status: v.status,
      feedback: v.feedback,
      createdAt: v.created_at,
    }),
  );

  return { problems, requests, versions };
}
