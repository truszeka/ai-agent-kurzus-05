# Deployment útmutató

> Quick scan · 2026-07-17 · forrás: [docker-compose.yml](../docker-compose.yml), [railpack.api.json](../railpack.api.json), [railpack.web.json](../railpack.web.json), [.github/workflows/](../.github/workflows/)

## Lokális infrastruktúra (Docker Compose)

`docker-compose.yml` — lokális PostgreSQL (a felhő-DB szándékosan nincs):

| Beállítás | Érték |
|-----------|-------|
| Image | `postgres:17-alpine` |
| Konténer | `plantbase-pg` |
| Port | host **5433** → konténer 5432 (az 5432-t más projekt foglalja) |
| DB / user / pass | `plantbase` / `plantbase` / `plantbase` |
| Volume | `plantbase-pgdata` |
| Initdb | `./docker/postgres/initdb` (a `plantbase_ro` SELECT-only szerepkört hozza létre — NFR1) |
| Healthcheck | `pg_isready -U plantbase -d plantbase` |

```bash
docker compose up -d
```

## Deploy — Railpack

### API / szerver — [railpack.api.json](../railpack.api.json)

- **Build:** nincs build lépés — a szerver forrásból fut `tsx`-szel.
- **Start:** `node_modules/.bin/tsx --conditions=@plantbase/source apps/server/src/main.ts`

### Web — [railpack.web.json](../railpack.web.json)

- **Build:** `pnpm exec nx build web`
- **Start:** `npx --yes serve -s apps/web/dist -l ${PORT:-4200}`

## CI — GitHub Actions

### [.github/workflows/ci.yml](../.github/workflows/ci.yml)

Minden `push` (main) és `pull_request` eseményre:

- pnpm (9.15.4) + Node 24 + pnpm cache
- `pnpm install --frozen-lockfile`
- `pnpm nx run-many -t lint test build typecheck`

> Az Nx Cloud elosztott futtatás szándékosan nincs bekapcsolva (a kurzushoz felesleges).

### [.github/workflows/claude-review.yml](../.github/workflows/claude-review.yml)

Claude-alapú automatikus PR-review workflow.

## Környezeti változók (deployhoz)

| Env | Szerep |
|-----|--------|
| `ANTHROPIC_API_KEY` | LLM hozzáférés |
| `ANTHROPIC_MODEL` | modell azonosító |
| `DATABASE_URL` | read-write (Prisma + ingest upsert) |
| `DATABASE_URL_READONLY` | read-only (query agent `runSql`) |
| `ORCHESTRATION_MODE` | `off` \| `router` \| `delegate` (a szerver kéri be per-request; jelenleg `off` az egy-agentes út) |
| `PORT` | web statikus kiszolgálás portja (railpack) |
