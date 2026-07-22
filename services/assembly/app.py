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
from pool import PoolLoader if False else None  # noqa: F401  (placeholder removed below)
