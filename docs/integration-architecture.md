# Integrációs architektúra

> Quick scan · 2026-07-17 · a részek közötti kommunikáció (monorepo, 5 rész)

## Függőségi térkép

```
apps/cli  ─────┐
               ├──►  packages/core  ──►  PostgreSQL (products)
apps/server ───┘         │                    ▲
   ▲                     │  (pg read-only: runSql)
   │  HTTP (streaming)   │  (pg read-write: upsertProduct)
apps/web                 │
                         └──►  packages/db  (Prisma: séma/migráció/seed; generált kliens)
```

## Integrációs pontok

| Honnan | Hová | Típus | Részletek |
|--------|------|-------|-----------|
| `apps/cli` | `@plantbase/core` | in-process import | `askAgent` / `askIngestAgent` közvetlen hívás |
| `apps/web` | `apps/server` | HTTP (streaming) | chat kérés; `@ai-sdk/react` ↔ `ai` SDK streaming protokoll |
| `apps/server` | `@plantbase/core` | in-process import | `askAgent` hívás, válasz streamelése a webnek |
| `@plantbase/core` | PostgreSQL | `pg` (read-only) | `runSql` — `DATABASE_URL_READONLY`, `plantbase_ro` szerepkör |
| `@plantbase/core` | PostgreSQL | `pg` (read-write) | `upsertProduct` — `DATABASE_URL`, külön pool |
| `@plantbase/core` | Shopify feed | HTTPS | `fetchFeed` — külső `products.json` (tropicalhome.hu / thesill.com) |
| `@plantbase/db` | PostgreSQL | Prisma | séma/migráció/seed a `DATABASE_URL`-en |

## Adat- és jogosultság-folyam (NFR1)

A rendszer **két DB-kapcsolatot** használ, jogosultság szerint szétválasztva:

- **Read-only út** (query agent): `runSql` → `sql-guard` (csak SELECT, 1 utasítás, kötelező LIMIT) → `START TRANSACTION READ ONLY` → `plantbase_ro` szerepkör. **Soha nem írhat.**
- **Read-write út** (Prisma migráció/seed + ingest `upsertProduct`): külön pool, Zod-validált, parametrizált, `latin_name`-re kulcsolt idempotens upsert.

Fontos: az agent **nem** Prisma-n át kérdez — a `runSql` közvetlen `pg` kapcsolat; a Prisma csak séma/migráció/seed/studio + a generált kliens.

## Orchestrációs módok

`ORCHESTRATION_MODE` (env, a szerver per-request olvassa):

| Mód | Viselkedés | Állapot |
|-----|-----------|---------|
| `off` (alap) | egy-agentes út, nincs `data-agent`/`data-tool`/`data-package` rész | **implementált** |
| `router` | orchestrator relézi a `requestInfo` kérdéseket az info-agenthez | dokumentált, **még nem implementált** |
| `delegate` | package-agent tool-ként hívja az info-agentet | dokumentált, **még nem implementált** |

> A `router`/`delegate` módokhoz tartozó `orchestrator-agent` és `package-agent` a kódban még nincs; jelenleg az `off` út él. A `delegate-to-ingest` tool megvan.

## Megosztott kód

- **`@plantbase/core`** a közös mag — a cli és a server is ezt importálja (nincs kódduplikáció a belépőpontok között).
- **`@plantbase/db`** adja a Prisma sémát és a generált klienst; a `core` a `pg`-t közvetlenül használja, nem a Prisma klienst.
- **`@plantbase/source`** export-condition: dev-módban a `core` forrásból fut (build nélkül).
