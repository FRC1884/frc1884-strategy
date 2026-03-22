# Deploy To jpclawhq

Production host: `jpclawhq` (`46.225.177.225`)

Domain:

- `griffins1884.org`
- `www.griffins1884.org`

App runtime:

- bare repo: `/home/mariano/git/frc1884-strategy.git`
- repo path: `/srv/frc1884-strategy`
- deploy branch: `deploy/jpclawhq-prod`
- app port: `3010`
- service: `frc1884-strategy.service`
- nginx site: `/etc/nginx/sites-available/griffins1884.org.conf`

## First-time setup

1. Push `deploy/jpclawhq-prod` to the server bare repo at `/home/mariano/git/frc1884-strategy.git`
2. Clone the deploy branch to `/srv/frc1884-strategy`
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

That performs the one-command deploy flow on the production checkout:

- `git pull --ff-only`
- `npm ci`
- `npm run build`
- `sudo systemctl restart frc1884-strategy.service`

## Local publish step

The production checkout pulls from the bare repo on `jpclawhq`, not from GitHub.

Push updates from your local machine with:

```bash
git push prod deploy/jpclawhq-prod
```

Then deploy on the server with:

```bash
cd /srv/frc1884-strategy && ./scripts/deploy-jpclawhq.sh
```
