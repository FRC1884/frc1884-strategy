# Deploy To jpclawhq

Production host: `jpclawhq` (`46.225.177.225`)

Domain:

- `griffins1884.org`
- `www.griffins1884.org`

App runtime:

- repo path: `/srv/frc1884-strategy`
- app port: `3010`
- service: `frc1884-strategy.service`
- nginx site: `/etc/nginx/sites-available/griffins1884.org.conf`

## First-time setup

1. Clone the deploy branch to `/srv/frc1884-strategy`
2. Run `npm ci`
3. Run `npm run build`
4. Install `deploy/systemd/frc1884-strategy.service` to `/etc/systemd/system/`
5. Install `deploy/nginx/griffins1884.org.conf` to `/etc/nginx/sites-available/`
6. Symlink the nginx site into `/etc/nginx/sites-enabled/`
7. `sudo systemctl daemon-reload`
8. `sudo systemctl enable --now frc1884-strategy.service`
9. `sudo nginx -t && sudo systemctl reload nginx`

## Future deploys

Run this on `jpclawhq`:

```bash
cd /srv/frc1884-strategy && ./scripts/deploy-jpclawhq.sh
```

That performs the intended one-command deploy flow:

- `git pull --ff-only`
- `npm ci`
- `npm run build`
- `sudo systemctl restart frc1884-strategy.service`
