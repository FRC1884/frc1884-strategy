# Deploy To jpclawhq

Production host: `jpclawhq` (`46.225.177.225`)

Domain:

- `griffins1884.org`
- `www.griffins1884.org`

App runtime:

- GitHub repo: `https://github.com/FRC1884/frc1884-strategy.git`
- repo path: `/srv/frc1884-strategy`
- deploy branch: `deploy/jpclawhq-prod`
- app port: `3010`
- service: `frc1884-strategy.service`
- nginx site: `/etc/nginx/sites-available/griffins1884.org.conf`

## First-time setup

1. Clone `https://github.com/FRC1884/frc1884-strategy.git` to `/srv/frc1884-strategy`
2. Check out `deploy/jpclawhq-prod`
3. Run `npm ci`
4. Run `npm run build`
5. Install `deploy/systemd/frc1884-strategy.service` to `/etc/systemd/system/`
6. Install `deploy/nginx/griffins1884.org.conf` to `/etc/nginx/sites-available/`
7. Symlink the nginx site into `/etc/nginx/sites-enabled/`
8. `sudo systemctl daemon-reload`
9. `sudo systemctl enable --now frc1884-strategy.service`
10. `sudo nginx -t && sudo systemctl reload nginx`

## Future deploys

Run this on `jpclawhq`:

```bash
cd /srv/frc1884-strategy && ./scripts/deploy-jpclawhq.sh
```

That performs the one-command deploy flow on the production checkout:

- `git pull --ff-only`
- `npm ci`
- `npm run build`
- `sudo systemctl restart frc1884-strategy.service`

## Local publish step

Push updates from your local machine with:

```bash
git push origin deploy/jpclawhq-prod
```

Then deploy on the server with:

```bash
cd /srv/frc1884-strategy && ./scripts/deploy-jpclawhq.sh
```
