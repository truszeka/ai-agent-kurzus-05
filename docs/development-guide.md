# Fejlesztői útmutató

> Quick scan · 2026-07-17 · forrás: gyökér [package.json](../package.json), [CLAUDE.md](../CLAUDE.md), [docker-compose.yml](../docker-compose.yml)

## Előfeltételek

| Eszköz | Verzió / megjegyzés |
|--------|---------------------|
| Node.js | 24 (a CI is `node-version: 24`) |
| pnpm | `corepack enable` (CI: 9.15.4) |
| Docker | lokális Postgres-hez (OrbStack / Docker Desktop) |
| Anthropic API kulcs | `.env` → `ANTHROPIC_API_KEY` |

## Első beállítás

```bash
pnpm install                 # postinstall: prisma generate
# .env feltöltése: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, DATABASE_URL, DATABASE_URL_READONLY
docker compose up -d         # Postgres a host 5433 porton (NEM 5432)
pnpm db:migrate && pnpm db:seed
```

> Megjegyzés: a repóban jelenleg `.env` van (nincs `.env.example`). A `config.ts` Zod-dal, fail-fast módon validálja: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DATABASE_URL_READONLY`. A `DATABASE_URL`-t a `db-readwrite.ts` validálja lokálisan.

## Gyökér scriptek (Nx-wrapper)

| Script | Mit csinál |
|--------|-----------|
| `pnpm build` | `nx run-many -t build` |
| `pnpm test` | `nx run-many -t test` (Vitest) |
| `pnpm lint` | `nx run-many -t lint` |
| `pnpm typecheck` | `nx run-many -t typecheck` |
| `pnpm format` / `format:check` | Prettier |
| `pnpm cli` | CLI dev (`tsx --conditions=@plantbase/source apps/cli/src/main.ts`) |
| `pnpm cli:build` | `nx build cli` |
| `pnpm server` | szerver dev (`tsx …/apps/server/src/main.ts`) |
| `pnpm web` | `nx dev web` (Vite) |
| `pnpm db:generate` | Prisma kliens generálás |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:reset` | drop + migrate + seed |
| `pnpm db:seed` | seed |
| `pnpm db:studio` | Prisma Studio (localhost:5555) |

## Per-projekt parancsok

```bash
pnpm nx build @plantbase/core
pnpm nx test @plantbase/core

# Egy teszt-fájl / egy teszt-név (Vitest args a -- után)
pnpm nx test @plantbase/core -- run src/lib/tools/run-sql/sql-guard.spec.ts
pnpm nx test @plantbase/core -- -t "rejects non-SELECT"
```

## Az agent futtatása (dev)

```bash
pnpm cli ask "mutass 3 pet-safe növényt raktáron, 5000 Ft alatt"
pnpm cli ask                 # interaktív lekérdező mód
pnpm cli ingest "..."        # katalógus-szerkesztő agent (ír!)
pnpm cli ask --quiet "..."   # csak a végső válasz, trace nélkül
```

## Dev vs. build feloldás (fontos)

A `@plantbase/core` `exports` mapja definiál egy `@plantbase/source` conditiont → `./src/index.ts`. A `pnpm cli`/`pnpm server` `tsx --conditions=@plantbase/source`-szal fut, így a `core` **TypeScript forrásból, build nélkül** él — a `core` szerkesztései azonnal hatnak. A tesztek és az `nx build` a fordított `./dist`-et használják, ezért érdemes buildet/typecheck-et futtatni, hogy elkapd, amit a source-út nem mutat.

## Kód-konvenciók

Lásd [konvenciok.md](./konvenciok.md), [dev-workflow.md](./dev-workflow.md) és a DDD doksikat ([ddd/model.md](./ddd/model.md), [ddd/glossary.md](./ddd/glossary.md)). Kulcs: minden felhasználói szöveg, komment és domain-szókincs **magyar**. Egy tool = egy könyvtár; a fájlnév hordozza a fajtát (`*-tool.ts`, `*-agent.ts`, `*-prompt.ts`).

## Tesztelés

Vitest, workspace-szinten (`vitest.workspace.ts`). A `core`-ban 9 `*.spec.ts` (pl. `sql-guard`, `run-sql` guard, orchestrátor-signal tesztek). Futtatás: `pnpm test` vagy per-projekt `pnpm nx test @plantbase/core`.
