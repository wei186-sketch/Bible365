#!/bin/sh
set -e

echo "=== Bible365 一键部署 ==="

# Wait for DB
echo "[1/3] 等待数据库就绪..."
until curl -s "http://db:5432" >/dev/null 2>&1 || pg_isready -h db -U bible -d bible365 2>/dev/null; do
  sleep 2
done
echo "      数据库已就绪"

# Run migrations
echo "[2/3] 执行数据库迁移..."
pnpm exec prisma db push --skip-generate 2>&1 || true
echo "      迁移完成"

# Start upload server (port 3001)
echo "[3/3] 启动服务..."
node scripts/upload-server.cjs &
sleep 1

# Start Next.js (port 3000)
pnpm start