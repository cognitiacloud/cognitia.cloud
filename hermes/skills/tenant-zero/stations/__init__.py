"""Tenant Zero proof-spine stations.

Each module exposes a pure ``run(...)`` that takes prior artifacts as plain
dicts and returns the dict body for its own artifact. The orchestrator
(``spine.py``) is responsible for reading fixtures, writing artifacts,
hashing them, and recording the run-state manifest. Keeping the stations
side-effect-light (station 8's local SQLite write is the sole exception)
is what makes them independently unit-testable.
"""
