#!/bin/bash
set -e

host="$1"
shift
cmd="$@"

until PGPASSWORD=keycloak123 psql -h "$host" -U "keycloak" -d "keycloak" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 2
done

>&2 echo "Postgres is up - executing command"
exec $cmd
