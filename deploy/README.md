# Deploy do WOK

Produção roda na própria máquina `eduardo-remote` (é ela que atende por
`runner.eduardotorres.dev` via Cloudflare Tunnel). Sem root: tudo vive no home do `admin`.

## Um comando

```bash
deploy/deploy.sh          # publica o commit atual de `pilot`
deploy/deploy.sh <ref>    # ou qualquer ref/sha (serve de rollback)
deploy/smoke.sh           # só o smoke test (domínio público); deploy/smoke.sh http://127.0.0.1:3300 para local
```

Só entra o que está **commitado** no ref (`git archive`), nunca o working tree.
Se o ref ainda não usa `@sveltejs/adapter-node`, o script troca o adapter apenas dentro da release.
Se a release nova não responder em 90s, o symlink volta para a anterior.

## Layout

| Caminho | O quê |
| --- | --- |
| `~/wok/releases/<data>-<sha>/` | releases (as 5 mais recentes) |
| `~/wok/current` | symlink para a release ativa |
| `~/wok/shared/.env` | segredos e config (chmod 600, fora do git; modelo em `env.example`) |
| `~/wok/bin/` | cópias estáveis de `supervise.sh` e `backup.sh` |
| `~/wok-data/` | `DATA_DIR` (SQLite), persiste entre releases |
| `~/wok-backups/` | `wok-data-*.tar.gz`, um por deploy (+ diário com o timer), 14 mais recentes |

## Processo

`supervise.sh` mantém `node --env-file=~/wok/shared/.env build` em `127.0.0.1:3300`,
reinicia se cair e quando `~/wok/current` muda. Restart manual: `touch ~/wok/restart`.

Hoje ele roda como runner `wok-prod` do board. Para passar para systemd (app e túnel) (sobrevive a
reboot e a restart do agentboard), pare os runners e, num shell normal:

```bash
cp deploy/systemd/wok*.service deploy/systemd/wok-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wok.service wok-tunnel.service wok-backup.timer
```

## Proxy / TLS

Cloudflare Tunnel próprio do app: túnel `wok` (id `218a17db-2bad-4ee2-a6f8-00174e410495`),
gerenciado pela Cloudflare (ingress `wok.eduardotorres.dev -> http://127.0.0.1:3300` fica no
painel/API, não em arquivo). TLS termina na Cloudflare. O túnel `runner` (SSH, config em
`/etc/cloudflared`) não foi alterado.

O conector roda como usuário, hoje no runner `wok-tunnel` do board:

```bash
cloudflared tunnel --no-autoupdate run --token-file ~/wok/shared/cloudflared.token
```

O token fica em `~/wok/shared/cloudflared.token` (chmod 600, fora do git). Para systemd,
use `deploy/systemd/wok-tunnel.service` do mesmo jeito que `wok.service`.

SSE (`/api/**/events`, `/api/browser/stream`): o túnel não bufferiza `text/event-stream`,
mas a borda da Cloudflare derruba conexão com 100s sem bytes. O servidor precisa mandar
heartbeat (comentário `: ping`) a cada ~15-30s e não comprimir essas respostas.

## Dependências da máquina

- Node 22 e pnpm 12 (aplica `minimumReleaseAge` do pnpm-workspace.yaml também ao lockfile) em `~/.local/bin`.
- Chromium do Playwright em `~/.cache/ms-playwright` (instalado a cada deploy na versão do
  lockfile; libs de sistema já presentes, sem `--with-deps` porque não há sudo).
- `tectonic` 0.15 em `~/.local/bin` (baixa pacotes TeX sob demanda para `~/.cache/Tectonic`).
