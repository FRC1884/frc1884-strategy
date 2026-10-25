#!/usr/bin/env bash
set -euo pipefail

# Installed root-owned; systemd executes this as frc1884-strategy-deploy, never root.
# Requests carry no trusted inputs. Only this fixed main branch is built.
rm -f /var/lib/frc1884-strategy-request/pending
cd /srv/frc1884-strategy
# Never deploy over source edits made by an operator on the live checkout.
git diff --quiet
git diff --cached --quiet
git fetch origin main
git switch main
git merge --ff-only origin/main
npm ci
npm run build
# The fixed activation unit only restarts this app; it executes no repo code.
touch /var/lib/frc1884-strategy-activate/ready
