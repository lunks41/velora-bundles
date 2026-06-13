#!/bin/sh
set -e

echo "=== Velora Bundles Starting ==="
echo "PORT=${PORT:-3000}"
echo "NODE_ENV=${NODE_ENV:-production}"

# Railway must reach the process on all interfaces, not localhost only
export HOST="0.0.0.0"

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
await prisma.\$disconnect();
console.log('Database connection OK');
"

if [ ! -f build/server/index.js ]; then
  echo "=== Build artifacts missing, running build ==="
  npm run build
fi

echo "=== Launching server on ${HOST}:${PORT:-3000} ==="
exec npm run start
