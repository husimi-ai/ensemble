"""Unit tests for the CP-SAT team-assembly model (task 010 verification).

Covers the three required cases: a balanced pool forms role-complete teams; a
lopsided pool returns INFEASIBLE with the missing roles; a dual-qualified
applicant covers a scarce role via eligibility. DB access is behind the pool
interface, so these exercise the solver on in-memory fixtures.
"""

from assemble import assemble
from pool import Applicant, FixturePoolLoader, applicants_from_dicts

R_PI = "problem_identifier"
R_B = "builder"
R_R = "researcher"


def _fs(*roles):
    return frozenset(roles)


def test_happy_path_forms_role_complete_teams():
    applicants = [
        Applicant("p1", _fs(R_PI), 0.9, 0.2),
        Applicant("b1", _fs(R_B), 0.8, 0.1),
        Applicant("r1", _fs(R_R), 0.7, 0.0),
        Applicant("p2", _fs(R_PI), 0.6, 0.0),
        Applicant("b2", _fs(R_B), 0.6, 0.0),
        Applicant("r2", _fs(R_R), 0.6, 0.0),
    ]
    res = assemble(applicants, team_min=3, team_max=3)

    assert not res.infeasible
    assert len(res.teams) == 2
    for team in res.teams:
        assert sorted(m.role for m in team.members) == sorted([R_PI, R_B, R_R])
    placed = [m.person_id for t in res.teams for m in t.members]
    assert len(placed) == len(set(placed)) == 6  # everyone used exactly once


def test_lopsided_pool_is_infeasible_with_missing_roles():
    applicants = [Applicant(f"b{i}", _fs(R_B), 0.8, 0.0) for i in range(8)]
    res = assemble(applicants, team_min=3, team_max=5)

    assert res.infeasible
    assert set(res.missing_roles) == {R_PI, R_R}
    payload = res.to_dict()
    assert payload["status"] == "INFEASIBLE"
    assert set(payload["missingRoles"]) == {R_PI, R_R}


def test_dual_qualified_applicant_covers_scarce_role():
    # No pure researcher exists: only d1 (builder OR researcher) can cover it,
    # so eligibility must place d1 as researcher to complete the team.
    applicants = applicants_from_dicts(
        [
            {"personId": "p1", "role": R_PI, "fit": 0.9},
            {"personId": "b1", "role": R_B, "fit": 0.9},
            {"personId": "d1", "roles": [R_B, R_R], "fit": 0.9},
        ]
    )
    res = assemble(applicants, team_min=3, team_max=3)

    assert not res.infeasible
    assert len(res.teams) == 1
    roles = {m.person_id: m.role for m in res.teams[0].members}
    assert roles["d1"] == R_R
    assert set(roles.values()) == {R_PI, R_B, R_R}


def test_fixture_loader_and_dict_parsing():
    loader = FixturePoolLoader(
        {"prob-1": [{"personId": "p1", "role": R_PI, "fit": 0.5, "proximity": 0.3}]}
    )
    pool = loader.load("prob-1")
    assert pool.problem_id == "prob-1"
    assert pool.applicants[0].person_id == "p1"
    assert pool.applicants[0].roles == _fs(R_PI)
    assert pool.applicants[0].proximity == 0.3
