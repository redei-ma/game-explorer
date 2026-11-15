#!/usr/bin/env bash
# Smoke test of the running stack, through the gateway: run it after
# `docker compose up -d`. Checks what docker-compose.yml and nginx.conf
# configure; nothing reaches IGDB. Run it at most once a minute: nginx
# remembers the login attempts.
set -euo pipefail

base=https://localhost:8443

check() {
  status=$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' "${@:3}" "$2")
  echo "$2 -> $status"
  if [ "$status" != "$1" ]; then
    echo "expected $1"
    exit 1
  fi
}

# up -d returns before the services answer: auth and library apply their
# database migrations first.
for service in catalog auth library; do
  echo "Waiting for $service"
  # One message instead of curl's error on every attempt
  if ! curl --insecure --silent --fail --output /dev/null \
    --retry 30 --retry-delay 2 --retry-all-errors "$base/health/$service"; then
    echo "$service is not answering"
    exit 1
  fi
done

check 301 http://localhost:8080/
check 200 "$base/"
check 200 "$base/games/42"
check 404 "$base/api/nonexistent"
check 401 "$base/api/auth/me"
check 401 "$base/api/library/favorites"
check 400 "$base/api/games/0"

# burst=5 lets 6 logins through at once, then nginx answers 429.
for attempt in 1 2 3 4 5 6 7; do
  expected=401
  if [ "$attempt" = 7 ]; then expected=429; fi
  check "$expected" "$base/api/auth/login" --request POST \
    --header 'Content-Type: application/json' --header 'X-CSRF-Token: 1' \
    --data '{"email":"nobody@example.com","password":"x"}'
done
