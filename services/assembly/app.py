"""Tiny HTTP surface for the assembly worker (spec T4, task 010).

Endpoints
  POST /assemble  -> role-complete team assignments, or
                     {"status": "INFEASIBLE", "missingRoles": [...]}
  GET  /health    -> liveness probe

Request body (JSON):
  {"problemId": "<uuid>", "teamMin": 3, "teamMax": 5, "lambda": 0.15}
If the body instead carries an inline "applicants" array it is used directly
(fixture / no-DB mode); otherwise the pool is loaded from Postgres by problemId
via ``PostgresPoolLoader``. Runs occasionally (when a pool is ready), not per
request, so a single synchronous solve per call is fine.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request

from assemble import (
    DEFAULT_LAMBDA,
    DEFAULT_TEAM_MAX,
    DEFAULT_TEAM_MIN,
    assemble,
)
from pool import PoolLoader, PostgresPoolLoader, applicants_from_dicts


def create_app(pool_loader: PoolLoader | None = None) -> Flask:
    app = Flask(__name__)
    loader = pool_loader or PostgresPoolLoader()

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.post("/assemble")
    def do_assemble():
        body = request.get_json(silent=True) or {}
        team_min = int(body.get("teamMin", DEFAULT_TEAM_MIN))
        team_max = int(body.get("teamMax", DEFAULT_TEAM_MAX))
        lam = float(body.get("lambda", DEFAULT_LAMBDA))
        max_teams = body.get("maxTeams")

        inline = body.get("applicants")
        if inline is not None:
            applicants = applicants_from_dicts(inline)
        else:
            problem_id = body.get("problemId")
            if not problem_id:
                return jsonify(error="problemId or applicants required"), 400
            try:
                applicants = list(loader.load(problem_id).applicants)
            except Exception as exc:  # DB / config failure -> service-unavailable
                return jsonify(error=str(exc)), 503

        result = assemble(
            applicants,
            team_min=team_min,
            team_max=team_max,
            lam=lam,
            max_teams=max_teams,
        )
        # Both OK and INFEASIBLE are successful computations (200); INFEASIBLE is
        # a business outcome the caller inspects via the body, not an HTTP error.
        return jsonify(result.to_dict()), 200

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
