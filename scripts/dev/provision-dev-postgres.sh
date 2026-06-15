#!/usr/bin/env bash
#
# provision-dev-postgres.sh — stand up a THROWAWAY local Postgres 16 cluster for
# V-6 managed-RLS verification. DEV ONLY. Never production.
#
# Why this exists: RLS is otherwise only proven on PGlite, whose default role is
# a superuser that BYPASSES row-level security. To actually close the V-6 risk we
# need a real Postgres server with a real, non-superuser login role. This script
# creates a fresh, isolated cluster (its own data dir + port) that holds NOTHING
# but seeded test rows, so its identity is unambiguously a throwaway.
#
# Usage:
#   scripts/dev/provision-dev-postgres.sh up      # create + start, prints DATABASE_URL
#   scripts/dev/provision-dev-postgres.sh down     # stop + DROP the cluster (destroys data)
#   scripts/dev/provision-dev-postgres.sh url      # print the DATABASE_URL for the cluster
#
# It deliberately uses a non-default cluster name + port so it can never collide
# with the packaged `16/main` cluster or a real service. The connection uses
# trust auth on localhost only (no password is created or printed).
#
# Requires: root (pg_createcluster manages the postgres system user), Debian/Ubuntu
# postgresql-16 packages (pg_createcluster, pg_ctlcluster).
set -euo pipefail

PG_VER="${PG_VER:-16}"
CLUSTER="${PG_CLUSTER:-v6dev}"
PORT="${PGPORT:-55432}"
DBNAME="${PGDATABASE:-cognitia_v6_dev}"
DBUSER="${PGUSER:-postgres}" # cluster superuser/owner — used ONLY for migrations + role creation
HOST="127.0.0.1"

url() {
  # No password: trust auth on localhost only. Safe to print (no secret).
  echo "postgresql://${DBUSER}@${HOST}:${PORT}/${DBNAME}"
}

cluster_exists() {
  pg_lsclusters -h 2>/dev/null | awk '{print $1"/"$2}' | grep -qx "${PG_VER}/${CLUSTER}"
}

up() {
  if cluster_exists; then
    echo "cluster ${PG_VER}/${CLUSTER} already exists; ensuring it is started" >&2
  else
    echo "creating throwaway cluster ${PG_VER}/${CLUSTER} on port ${PORT}" >&2
    pg_createcluster "${PG_VER}" "${CLUSTER}" -p "${PORT}" -- \
      --auth-local=trust --auth-host=trust >&2
  fi
  pg_ctlcluster "${PG_VER}" "${CLUSTER}" start >&2 || true
  # Create the dev database if absent (idempotent).
  if ! runuser -u postgres -- psql -p "${PORT}" -tAc \
    "select 1 from pg_database where datname='${DBNAME}'" | grep -q 1; then
    runuser -u postgres -- createdb -p "${PORT}" "${DBNAME}" >&2
  fi
  echo "READY. Throwaway dev DB up (holds only seeded test rows)." >&2
  url
}

down() {
  if cluster_exists; then
    echo "stopping + dropping throwaway cluster ${PG_VER}/${CLUSTER} (destroys all data)" >&2
    pg_ctlcluster "${PG_VER}" "${CLUSTER}" stop >&2 || true
    pg_dropcluster "${PG_VER}" "${CLUSTER}" >&2
    echo "dropped." >&2
  else
    echo "no cluster ${PG_VER}/${CLUSTER} to drop." >&2
  fi
}

case "${1:-up}" in
up) up ;;
down) down ;;
url) url ;;
*)
  echo "usage: $0 {up|down|url}" >&2
  exit 2
  ;;
esac
