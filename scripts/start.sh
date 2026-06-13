#!/bin/sh
set -e

echo "=== Velora Bundles Starting ==="
echo "PORT=${PORT:-(not set — Railway will inject this)}"
echo "NODE_ENV=${NODE_ENV:-production}"

if [ -n "$PORT" ] && [ "$PORT" = "3000" ]; then
  echo "WARNING: PORT is hardcoded to 3000. Remove PORT from Railway Variables"
  echo "         so Railway can inject the correct port (usually 8080)."
fi

# Railway must reach the process on all interfaces, not localhost only
export HOST="0.0.0.0"
# Don't crash the whole process if Shopify session storage init is slow
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--unhandled-rejections=warn"

for var in DATABASE_URL SHOPIFY_API_KEY SHOPIFY_API_SECRET SHOPIFY_APP_URL; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "ERROR: Missing required env var: $var"
    exit 1
  fi
done

echo "=== Running prisma generate ==="
npx prisma generate

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy

echo "=== Verifying database connection ==="
node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.\$queryRaw\`SELECT 1\`;
await prisma.session.count();
await prisma.\$disconnect();
console.log('Database and Session table OK');
"

if [ ! -f build/server/index.js ]; then
  echo "=== Build artifacts missing, running build ==="
  npm run build
fi

echo "=== Launching server on ${HOST}:${PORT:-8080} ==="
exec node server.mjs
