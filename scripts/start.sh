#!/bin/sh
set -e

echo "=== Velora Bundles Starting ==="
echo "PORT=${PORT:-8080}"
echo "NODE_ENV=${NODE_ENV:-production}"

export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--unhandled-rejections=warn"

for var in DATABASE_URL SHOPIFY_API_KEY SHOPIFY_API_SECRET SHOPIFY_APP_URL; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "ERROR: Missing required env var: $var"
    exit 1
  fi
done

if [ ! -f build/server/index.js ]; then
  echo "ERROR: build/server/index.js missing — rebuild the Docker image"
  exit 1
fi

if [ ! -f server.mjs ]; then
  echo "ERROR: server.mjs missing — rebuild the Docker image"
  exit 1
fi

# Start web server immediately so Railway can reach /healthcheck
echo "=== Starting web server on port ${PORT:-8080} ==="
node server.mjs &
SERVER_PID=$!

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy || {
  echo "WARNING: prisma migrate deploy failed — server still running for debugging"
}

echo "=== Server ready (pid $SERVER_PID) ==="
wait $SERVER_PID
