/**
 * Problem listings and applications to them. Mirrors `problems`,
 * `applications` (task 001, migration `0002_core_entities.sql`). The
 * `embedding halfvec(1024)` column on `problems` is DB/pgvector-only and is
 * not surfaced in TS.
 */

/** Where a problem came from. Column `problems.origin`. */
export type ProblemOrigin = "founder_seeded" | "user_submitted";

/** Listing lifecycle. Column `problems.status`. */
export type ProblemStatus = "draft" | "review" | "published";

/**
 * A problem listing. Table `problems`. DB mapping:
 * `requiredRoles`<->`required_roles`, `requiredSkills`<->`required_skills`,
 * `submittedBy`<->`submitted_by`, `createdAt`<->`created_at`.
 */
export interface Problem {
  id: string;
  title: string;
  description: string;
  subfield: string | null;
  tags: string[];
  requiredRoles: string[];
  requiredSkills: string[];
  origin: ProblemOrigin;
  submittedBy: string | null;
  status: ProblemStatus;
  createdAt: string;
  updatedAt: string;
}

/** Classified role a user applies as. Column `applications.role`. */
export type ApplicationRole = "problem_identifier" | "builder" | "researcher";

/** Application lifecycle; `feedback` fuels the unmatched-retry loop (C16). */
export type ApplicationStatus = "pending" | "assembled" | "unmatched";

/**
 * A User -> Problem application. Table `applications`. DB mapping:
 * `userId`<->`user_id`, `problemId`<->`problem_id`.
 */
export interface Application {
  id: string;
  userId: string;
  problemId: string;
  role: ApplicationRole;
  status: ApplicationStatus;
  feedback: string | null;
  createdAt: string;
}
