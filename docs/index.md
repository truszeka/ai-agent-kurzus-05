# Plantbase — dokumentációs index

> 👆 Ez az **elsődleges belépőpont** az AI-asszisztált fejlesztéshez.
> Generálva: 2026-07-17 · `bmad-document-project` (initial scan, **quick**) · nyelv: magyar

## Projekt áttekintés

- **Típus:** monorepo (Nx + pnpm), **5 rész**
- **Elsődleges nyelv:** TypeScript (ESM)
- **Architektúra:** framework-agnosztikus agent-mag (`core`) + belépőpontok (cli / server+web) + Prisma adatréteg
- **Domain:** természetes nyelvű kérdés → read-only SQL a növény-katalógus felett → magyar válasz (lakberendező persona)

## Gyors referencia (részenként)

| Rész | Csomag | Típus | Stack | Gyökér |
|------|--------|-------|-------|--------|
| core | `@plantbase/core` | library | AI SDK 6, `@ai-sdk/anthropic`, `pg`, `zod` | `packages/core` |
| db | `@plantbase/db` | library | Prisma 6, PostgreSQL 17 | `packages/db` |
| cli | `@plantbase/cli` | CLI | commander, dotenv, tsx | `apps/cli` |
| server | `@plantbase/server` | backend | express, cors, `ai` | `apps/server` |
| web | `@plantbase/web` | web | React 19, Vite, Tailwind, shadcn/radix, `@ai-sdk/react` | `apps/web` |

## Generált dokumentáció

- [Projekt áttekintés](./project-overview.md)
- [Source tree elemzés](./source-tree-analysis.md)
- [Adatmodell](./data-models.md)
- [Fejlesztői útmutató](./development-guide.md)
- [Deployment útmutató](./deployment-guide.md)
- [Integrációs architektúra](./integration-architecture.md)

### Architektúra részenként

- [Architektúra — core](./architecture-core.md)
- [Architektúra — db](./architecture-db.md)
- [Architektúra — cli](./architecture-cli.md)
- [Architektúra — server](./architecture-server.md)
- [Architektúra — web](./architecture-web.md)

## Meglévő dokumentáció (a repóban)

- [architektura.md](./architektura.md) — struktúra + kulcsdöntések
- [system-prompt.md](./system-prompt.md) — az SQL-szabályok forrása
- [konvenciok.md](./konvenciok.md) — TS konvenciók
- [dev-workflow.md](./dev-workflow.md) — fejlesztői munkafolyamat
- [ddd/model.md](./ddd/model.md) — domain-modell
- [ddd/glossary.md](./ddd/glossary.md) — ubiquitous language
- [stack.md](./stack.md) — technológiai stack
- [brs-plantbase.md](./brs-plantbase.md) — üzleti követelmények
- [proposal-implementacio.md](./proposal-implementacio.md) — implementációs javaslat
- [setup-instructions.md](./setup-instructions.md) — részletes beállítás
- [convention-audit-report.md](./convention-audit-report.md) — konvenció-audit riport
- [ora7hw.md](./ora7hw.md) — kurzus házi feladat

## ⚠️ Fontos: dokumentáció vs. kód

A [CLAUDE.md](../CLAUDE.md) nagyobb rendszert ír le, mint ami jelenleg a kódban van. A **generált doksik a tényleges kódállapotot** rögzítik:

- **Implementált agentek:** `query-agent`, `ingest-agent`.
- **Még NEM implementált** (bár dokumentált): `orchestrator-agent`, `package-agent`, router/delegate handover, valamint a `packages` / `package_items` / `customers` táblák. A Prisma séma **csak a `Product`** modellt tartalmazza.

## Kezdés

```bash
pnpm install
# .env kitöltése (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, DATABASE_URL, DATABASE_URL_READONLY)
docker compose up -d          # Postgres a host 5433 porton
pnpm db:migrate && pnpm db:seed
pnpm cli ask "mutass 3 pet-safe növényt raktáron, 5000 Ft alatt"
```

Részletek: [Fejlesztői útmutató](./development-guide.md).

## Következő lépés a BMad-ben

Brownfield PRD tervezésekor a PRD workflow (`bmad-prd`, `[PRD]`) bemenetének **ezt az indexet** add meg: `docs/index.md`.
