#!/bin/sh
set -e

echo "=== Velora Bundles Starting ==="
echo "PORT=$PORT"
echo "HOST=$HOST"
echo "NODE_ENV=$NODE_ENV"

echo "=== Running prisma generate ==="
npx prisma generate

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy

echo "=== Launching server on port ${PORT:-3000} ==="
exec npm run start
