/**
 * Client for the Python assembly worker (task 010) at `ASSEMBLY_WORKER_URL`.
 * Contract (010 `app.py`): `POST /assemble` with `{ problemId }` (worker loads
 * the pool from Postgres) or `{ applicants }` (inline fixture mode), returns 200
 * with either `{ status: "OK", teams: [{ members: [{ personId, role, fit,
 * proximity }] }] }` or `{ status: "INFEASIBLE", missingRoles: [...] }`. Both are
 * successful computations; a non-2xx is a transport/DB failure we surface.
 *
 * Server-only (reads the worker URL secret). Import via `@/lib/teams`.
 */

/** One placed applicant in a returned team (`role` is a `profile_role`). */
export interface WorkerMember {
  personId: string;
  role: string;
  fit: number;
  proximity: number;
}

/** A role-complete team the worker formed. */
export interface WorkerTeam {
  members: WorkerMember[];
}

/** The `POST /assemble` response body (200 in both cases). */
export type AssembleResponse =
  | { status: "OK"; teams: WorkerTeam[] }
  | { status: "INFEASIBLE"; missingRoles: string[] };

/** Request body accepted by the worker (problemId path or inline applicants). */
export interface AssembleRequestBody {
  problemId?: string;
  applicants?: unknown[];
  teamMin?: number;
  teamMax?: number;
  lambda?: number;
  maxTeams?: number;
}

/** POST the pool to the worker's `/assemble` and return its decision. */
export async function callAssembleWorker(
  body: AssembleRequestBody,
): Promise<AssembleResponse> {
  const base = process.env.ASSEMBLY_WORKER_URL;
  if (!base) throw new Error("ASSEMBLY_WORKER_URL is not configured");

  const res = await fetch(`${base.replace(/\/+$/, "")}/assemble`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`assembly worker ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as AssembleResponse;
}
