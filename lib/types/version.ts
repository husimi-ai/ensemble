/**
 * Submitted work versions, long-running research jobs, and the network graph.
 * Mirrors `versions`, `research_jobs`, `connections` (task 001, migration
 * `0004_requests_versions_jobs.sql`).
 */

/** Version lifecycle across iterative takeover/publication (C13/C14). */
export type VersionStatus = "submitted" | "feedback" | "taken_over" | "published";

/**
 * A group's submitted paper + codebase. Table `versions`. DB mapping:
 * `groupId`<->`group_id`, `versionNo`<->`version_no`, `paperRef`<->`paper_ref`,
 * `repoRef`<->`repo_ref` (Storage paths / external refs).
 */
export interface Version {
  id: string;
  groupId: string;
  versionNo: number;
  paperRef: string | null;
  repoRef: string | null;
  status: VersionStatus;
  createdAt: string;
}

/** Research-job lifecycle for the Agent-SDK worker (T5). Column `research_jobs.status`. */
export type ResearchJobStatus = "queued" | "running" | "done" | "error";

/**
 * A long-running, budget-capped research job whose result is posted back as an
 * assistant message. Table `research_jobs`. DB mapping: `roomId`<->`room_id`,
 * `requestedBy`<->`requested_by`, `costUsd`<->`cost_usd`; `progress` is jsonb.
 */
export interface ResearchJob {
  id: string;
  roomId: string;
  requestedBy: string;
  status: ResearchJobStatus;
  progress: unknown;
  costUsd: number | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A weighted network-closeness edge between two users, feeding the bounded
 * proximity boost in matching (F7). Table `connections`. DB mapping:
 * `userA`<->`user_a`, `userB`<->`user_b`.
 */
export interface Connection {
  id: string;
  userA: string;
  userB: string;
  weight: number;
}
