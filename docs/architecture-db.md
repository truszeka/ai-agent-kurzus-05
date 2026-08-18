# Architektúra — `@plantbase/db` (db)

> Quick scan · 2026-07-17 · típus: library (adatréteg)

## Összefoglaló

Prisma-alapú adatréteg: séma, migrációk, seed és a **generált kliens**. Fontos: a query agent **nem** Prisma-n át kérdez — a `runSql` közvetlen `pg` read-only kapcsolatot használ. A Prisma szerepe: séma/migráció/seed/studio + a generált kliens.

## Technológiai stack

| Kategória | Technológia |
|-----------|-------------|
| ORM | Prisma 6 |
| DB | PostgreSQL 17 (Docker, `postgres:17-alpine`) |
| Generált kliens | `packages/db/generated/client/` (postinstall: `prisma generate`) |

## Struktúra

```
packages/db/prisma/
├── schema.prisma       # séma (jelenleg 1 modell: Product)
├── migrations/
│   ├── 20260629155056_init_products/
│   └── migration_lock.toml
└── seed.ts             # prisma db seed belépő
```

## Adatmodell

Jelenleg **egyetlen modell**: `Product` (a katalógus). Részletek: [data-models.md](./data-models.md).

> **Nincs még a sémában** (a CLAUDE.md említi): `packages`, `package_items`, `customers` táblák. Ezek a növénycsomag-flow-hoz kellenének, ami még nincs implementálva.

## Két DB URL / két szerepkör

| Env | Szerep | Használó |
|-----|--------|----------|
| `DATABASE_URL` | read-write | Prisma (migráció/seed) + ingest `upsertProduct` |
| `DATABASE_URL_READONLY` | read-only | query agent `runSql` (`plantbase_ro` szerepkör) |

A `plantbase_ro` (SELECT-only) szerepkört a `docker/postgres/initdb` script hozza létre konténer-indításkor.

## Parancsok

| Parancs | Művelet |
|---------|---------|
| `pnpm db:generate` | Prisma kliens generálása |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | idempotens seed (~30 növény) |
| `pnpm db:reset` | drop + migrate + seed |
| `pnpm db:studio` | Prisma Studio |

A séma útvonala mindenhol explicit: `--schema=packages/db/prisma/schema.prisma`.
