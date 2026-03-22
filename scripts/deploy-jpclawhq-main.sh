#!/usr/bin/env bash
set -euo pipefail

cd /srv/frc1884-strategy
git switch main 2>/dev/null || git switch -c main --track origin/main
git pull --ff-only origin main
mkdir -p data
mkdir -p log
npm ci
npm run build
sudo systemctl restart frc1884-strategy.service
sudo systemctl status --no-pager frc1884-strategy.service
sudo nginx -t
sudo systemctl reload nginx
