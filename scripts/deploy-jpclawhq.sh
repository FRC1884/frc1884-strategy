#!/usr/bin/env bash
set -euo pipefail

cd /srv/frc1884-strategy
git pull --ff-only
npm ci
npm run build
sudo systemctl restart frc1884-strategy.service
sudo systemctl status --no-pager frc1884-strategy.service
