#!/usr/bin/env bash
set -euo pipefail
# Operator compatibility entry point: use the dedicated unprivileged builder.
exec sudo /usr/bin/systemctl start frc1884-strategy-deploy.service
