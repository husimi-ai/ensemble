"""CP-SAT balanced-team assembly (spec T4, task 010).

Model: binary ``x[person, team, role]``. Each person is placed on at most one
team in at most one role. Each *used* team must cover all three roles
(problem_identifier / builder / researcher) with >=1 member each and hold
``[team_min, team_max]`` members. The number of teams is free; the objective
maximizes the count of role-complete teams first, then the total
``fit * (1 + lambda * proximity)`` of the people placed (a strict lexicographic
priority via a bonus that dominates any weight redistribution).

Thin/lopsided pools where a role has no eligible applicant are detected by a
cheap role-coverage precheck (the ``COUNT(*) GROUP BY role`` idea from F7) and
reported INFEASIBLE with the missing roles -- the widen signal task 011 acts on.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional

from ortools.sat.python import cp_model

from pool import ROLES, Applicant

DEFAULT_TEAM_MIN = 3
DEFAULT_TEAM_MAX = 5
DEFAULT_LAMBDA = 0.15
_WEIGHT_SCALE = 1000  # fit/proximity are floats; CP-SAT needs an integer objective
_SOLVE_SECONDS = 10.0


@dataclass(frozen=True)
class Member:
    person_id: str
    role: str
    fit: float
    proximity: float

    def to_dict(self) -> dict:
        return {
            "personId": self.person_id,
            "role": self.role,
            "fit": self.fit,
            "proximity": self.proximity,
        }


@dataclass(frozen=True)
class Team:
    members: tuple

    def to_dict(self) -> dict:
        return {"members": [m.to_dict() for m in self.members]}


@dataclass(frozen=True)
class AssembleResult:
    teams: tuple = ()
    infeasible: bool = False
    missing_roles: tuple = ()

    def to_dict(self) -> dict:
        if self.infeasible:
            return {"status": "INFEASIBLE", "missingRoles": list(self.missing_roles)}
        return {"status": "OK", "teams": [t.to_dict() for t in self.teams]}


def _missing_roles(applicants: list[Applicant]) -> tuple:
    """Roles for which no applicant is eligible -- the cheap INFEASIBLE precheck."""
    present: set = set()
    for a in applicants:
        present |= set(a.roles)
    return tuple(r for r in ROLES if r not in present)


def assemble(
    applicants: Iterable[Applicant],
    team_min: int = DEFAULT_TEAM_MIN,
    team_max: int = DEFAULT_TEAM_MAX,
    lam: float = DEFAULT_LAMBDA,
    max_teams: Optional[int] = None,
) -> AssembleResult:
    """Form as many role-complete teams as possible from ``applicants``."""
    # A team needs at least one distinct person per role, so team_min >= 3.
    team_min = max(int(team_min), len(ROLES))
    team_max = max(int(team_max), team_min)
    lam = float(lam)
    applicants = list(applicants)

    missing = _missing_roles(applicants)
    if missing:
        return AssembleResult(infeasible=True, missing_roles=missing)

    n = len(applicants)
    upper = n // team_min
    if max_teams is not None:
        upper = min(upper, int(max_teams))
    if upper < 1:
        # Roles are all present but the pool is too thin to fill one min team.
        return AssembleResult(infeasible=True, missing_roles=())

    model = cp_model.CpModel()

    # x[(i, t, r)] exists only where applicant i is eligible for role r.
    x: dict = {}
    for i, a in enumerate(applicants):
        for t in range(upper):
            for r in a.roles:
                x[(i, t, r)] = model.NewBoolVar(f"x_{i}_{t}_{r}")
    used = [model.NewBoolVar(f"used_{t}") for t in range(upper)]

    # Each person on at most one team in at most one role.
    for i, a in enumerate(applicants):
        model.Add(
            sum(x[(i, t, r)] for t in range(upper) for r in a.roles) <= 1
        )

    for t in range(upper):
        team_vars = [
            x[(i, t, r)] for i, a in enumerate(applicants) for r in a.roles
        ]
        # Covering: when the team is used, every role has >= 1 member.
        for r in ROLES:
            role_vars = [
                x[(i, t, r)] for i in range(n) if (i, t, r) in x
            ]
            model.Add(sum(role_vars) >= used[t])
        # Size bounds, gated so an unused team holds nobody.
        model.Add(sum(team_vars) <= team_max * used[t])
        model.Add(sum(team_vars) >= team_min * used[t])

    # Symmetry break: fill lower-indexed teams first (faster, deterministic).
    for t in range(upper - 1):
        model.Add(used[t] >= used[t + 1])

    # Objective: role-complete team count strictly dominates placement quality.
    weights = [
        round(_WEIGHT_SCALE * a.fit * (1.0 + lam * a.proximity)) for a in applicants
    ]
    bonus = sum(w for w in weights if w > 0) + 1
    terms = [bonus * used[t] for t in range(upper)]
    for (i, t, r), var in x.items():
        if weights[i]:
            terms.append(weights[i] * var)
    model.Maximize(sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = _SOLVE_SECONDS
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return AssembleResult(infeasible=True, missing_roles=())

    teams: list = []
    for t in range(upper):
        if solver.Value(used[t]) != 1:
            continue
        members: list = []
        for i, a in enumerate(applicants):
            for r in a.roles:
                if solver.Value(x[(i, t, r)]) == 1:
                    members.append(Member(a.person_id, r, a.fit, a.proximity))
        if members:
            teams.append(Team(tuple(members)))

    if not teams:
        return AssembleResult(infeasible=True, missing_roles=())
    return AssembleResult(teams=tuple(teams))
