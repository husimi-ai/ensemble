"""Applicant-pool loading for team assembly (spec T4, task 010).

The CP-SAT model in ``assemble.py`` consumes an in-memory list of ``Applicant``
rows; this module defines that shape and the loaders that produce it.

``PostgresPoolLoader`` reads a problem's pending applications joined to profiles
and derives, per applicant, the two precomputed signals the solver optimizes:
``fit`` (embedding similarity of the applicant's profile to the problem, mirroring
the 009 matching engine) and ``proximity`` (the bounded institution/geo tier from
0008's ``proximity_tier``). So the solver never touches the DB directly.

DB access lives entirely behind the ``PoolLoader`` interface: tests and the no-DB
HTTP path build applicants from plain dicts via ``applicants_from_dicts`` instead
(stop condition: assembly is verified on in-memory fixtures; live DB unverified).
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable, Optional

# The three balanced-team roles (matches profile_role in migration 0002 and the
# application role classified at apply time). A team must cover all three.
ROLES = ("problem_identifier", "builder", "researcher")


@dataclass(frozen=True)
class Applicant:
    """One person in a problem's applicant pool.

    ``roles`` is the set of roles this person is *eligible* to fill (usually the
    single classified role, but a dual-qualified applicant carries more than one,
    letting the solver place them wherever a team is short). ``fit`` and
    ``proximity`` are precomputed match signals; the objective weights each
    placement by ``fit * (1 + lambda * proximity)``.
    """

    person_id: str
    roles: frozenset  # subset of ROLES this person may fill
    fit: float = 1.0        # 0..1 quality of match to the problem (F7)
    proximity: float = 0.0  # bounded proximity boost (~0..1.3)


def _clean_roles(roles: Iterable[str]) -> frozenset:
    cleaned = frozenset(r for r in roles if r in ROLES)
    if not cleaned:
        raise ValueError(f"applicant has no valid role in {ROLES}: {list(roles)!r}")
    return cleaned


def applicants_from_dicts(rows: Iterable[dict]) -> list[Applicant]:
    """Build ``Applicant`` objects from loosely-typed dicts.

    Accepts either a ``roles`` list or a single ``role`` string, and camelCase or
    snake_case id keys, so the same helper serves DB rows, HTTP request bodies,
    and test fixtures.
    """
    out: list[Applicant] = []
    for row in rows:
        raw_roles = row.get("roles")
        if raw_roles is None:
            one = row.get("role")
            raw_roles = [one] if one else []
        pid = row.get("personId") or row.get("person_id") or row.get("user_id")
        if pid is None:
            raise ValueError(f"applicant row missing person id: {row!r}")
        out.append(
            Applicant(
                person_id=str(pid),
                roles=_clean_roles(raw_roles),
                fit=float(row.get("fit", 1.0) or 0.0),
                proximity=float(row.get("proximity", 0.0) or 0.0),
            )
        )
    return out


@dataclass(frozen=True)
class ApplicantPool:
    problem_id: str
    applicants: tuple


class PoolLoader(ABC):
    """Interface for loading a problem's applicant pool. Swap the concrete
    loader (Postgres in prod, fixtures in tests) without touching the solver."""

    @abstractmethod
    def load(self, problem_id: str) -> ApplicantPool:  # pragma: no cover - abstract
        ...


# fit  = cosine similarity of applicant profile embedding to the problem embedding
#        (clamped to [0,1]); proximity = bounded tier vs the problem submitter's
#        anchor (0008.proximity_tier). Runtime-unverified without live DB/keys.
_POOL_SQL = """
select
  a.user_id::text as person_id,
  a.role::text    as role,
  greatest(0.0, least(1.0,
    coalesce(1.0 - (pr.embedding <=> pb.embedding), 0.0))) as fit,
  coalesce(least(1.3, public.proximity_tier(
      pr.facility_id, pr.institution_id, pr.city, pr.lat, pr.long,
      sp.facility_id, sp.institution_id, sp.city, sp.lat, sp.long)), 0.0) as proximity
from public.applications a
join public.problems  pb on pb.id = a.problem_id
join public.profiles  pr on pr.user_id = a.user_id
left join public.profiles sp on sp.user_id = pb.submitted_by
where a.problem_id = %(problem_id)s
  and a.status = 'pending'
  and a.role is not null
"""


class PostgresPoolLoader(PoolLoader):
    """Load the pool from Supabase Postgres via a service-role/scoped-read DSN."""

    def __init__(self, dsn: Optional[str] = None):
        self._dsn = dsn or os.environ.get("DATABASE_URL") or os.environ.get(
            "SUPABASE_DB_URL"
        )

    def load(self, problem_id: str) -> ApplicantPool:
        if not self._dsn:
            raise RuntimeError("no DATABASE_URL / SUPABASE_DB_URL configured")
        import psycopg  # imported lazily so the module compiles without the driver

        with psycopg.connect(self._dsn) as conn, conn.cursor() as cur:
            cur.execute(_POOL_SQL, {"problem_id": problem_id})
            cols = [d.name for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return ApplicantPool(problem_id, tuple(applicants_from_dicts(rows)))


class FixturePoolLoader(PoolLoader):
    """In-memory loader for tests / the no-DB HTTP path. ``pools`` maps a
    problem id to a list of ``Applicant`` objects or plain dict rows."""

    def __init__(self, pools: dict):
        self._pools = pools

    def load(self, problem_id: str) -> ApplicantPool:
        rows = self._pools.get(problem_id, [])
        applicants = tuple(
            r if isinstance(r, Applicant) else applicants_from_dicts([r])[0]
            for r in rows
        )
        return ApplicantPool(problem_id, applicants)
