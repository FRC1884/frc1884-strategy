#!/usr/bin/env bash
set -euo pipefail

cd /srv/frc1884-strategy
git pull --ff-only
mkdir -p data
npm ci
npm run build
sudo systemctl restart frc1884-strategy.service
sudo systemctl status --no-pager frc1884-strategy.service
