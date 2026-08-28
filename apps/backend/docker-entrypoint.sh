#!/bin/sh
set -e

echo "→ Chay migration..."
npx prisma migrate deploy

if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "→ Chay seed..."
  node prisma/seed.js || echo "⚠ Seed that bai, bo qua va chay tiep"
fi
if [ "$BOOTSTRAP_BOARD_ON_BOOT" = "true" ]; then
  echo "→ Bootstrap thiet bi that..."
  node prisma/bootstrap-board.js || echo "⚠ Bootstrap board that bai, bo qua"
fi
echo "→ Khoi dong backend..."
exec node src/server.js
