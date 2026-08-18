# Plantbase — Projekt áttekintés

> Generálva: 2026-07-17 · `bmad-document-project` (initial scan, quick) · nyelv: magyar

## Mi ez?

**Plantbase** egy kurzus-projekt: parancssori (majd webes) **AI agent**, amely a természetes nyelvű kérdést **read-only SQL-re** fordítja egy növény-katalógus (`products` tábla) felett, lefuttatja, és **magyar nyelvű választ** ad. Önkiszolgáló analitika SQL-tudás nélkül.

A persona egy **lakberendező**, aki a szoba adottságai (fény, méret), az ügyfél igényei és a büdzsé alapján állít össze növénycsomagot. Pedagógiai cél: az agent mechanikája **rétegről rétegre látsszon** (echo → LLM → SQL-es tool), **agent-framework nélkül**.

## Repository típusa

**Nx + pnpm monorepo**, 5 részre bontva:

| Rész | Csomag | Típus | Felelősség |
|------|--------|-------|------------|
| **core** | `@plantbase/core` | library | Framework-agnosztikus agent-logika (loop, promptok, tool-ok, trace) |
| **db** | `@plantbase/db` | library | Prisma séma, migrációk, seed, generált kliens |
| **cli** | `@plantbase/cli` | CLI | commander + readline belépőpont (`ask`, `ingest`) |
| **server** | `@plantbase/server` | backend | Express chat-szerver, streaming válasz |
| **web** | `@plantbase/web` | web | React 19 + Vite + Tailwind chat-UI |

## Technológiai stack (összefoglaló)

| Kategória | Technológia |
|-----------|-------------|
| Nyelv | TypeScript (ESM) |
| Monorepo | Nx + pnpm workspaces |
| LLM | Anthropic Claude, Vercel **AI SDK 6** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`) |
| Adatbázis | PostgreSQL 17, **Prisma 6** ORM (séma/migráció/seed) + közvetlen `pg` (read-only lekérdezés) |
| Validáció | Zod |
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui + Radix |
| Backend | Express + CORS |
| Konténer | Docker Compose (lokális Postgres, host port **5433**) |
| Deploy | Railpack (api + web) |
| CI | GitHub Actions (lint/test/build/typecheck) + Claude review workflow |

## Architektúra dióhéjban

```
felhasználó ──► belépőpont (cli / server+web) ──► @plantbase/core: askAgent
                                                    │  1. system prompt (séma + szabályok, XML-tagolt)
                                                    │  2. generateText (AI SDK 6, stopWhen: stepCountIs)
                                                    │  3. tool: runSql (read-only) / getClientPreferences
                                                    │  4. magyar válasz
                                                    ▼
                                          PostgreSQL (products)
```

**Kulcs biztonsági elv (NFR1 — read/write szétválasztás):** a lekérdező út **soha nem írhat**. Három egymástól független réteg: (1) `plantbase_ro` Postgres szerepkör (csak SELECT), (2) `sql-guard.ts` (csak `SELECT`/`WITH … SELECT`, egyetlen utasítás, kötelező `LIMIT`), (3) minden lekérdezés `START TRANSACTION READ ONLY`-ban fut. Írni kizárólag Prisma (migráció/seed) és az ingest agent `upsertProduct`-ja tud, külön read-write pg pool-on.

## A dokumentáció és a kód eltérése (fontos)

A [CLAUDE.md](../CLAUDE.md) egy nagyobb rendszert ír le, mint ami jelenleg a kódban van. **A jelen dokumentáció a tényleges kódállapotot rögzíti:**

- **Implementált agentek:** `query-agent`, `ingest-agent` (`packages/core/src/lib/agents/`).
- **CLAUDE.md-ben leírt, de a kódban még nem létező** elemek: `orchestrator-agent`, `package-agent`, `router-handover`/`delegate-handover`, valamint a `packages` / `customers` / `package_items` táblák. A Prisma séma jelenleg **csak a `Product` modellt** tartalmazza.
- A `delegate-to-ingest` tool létezik (`tools/delegate-to-ingest/`), de a teljes orchestrációs réteg még nincs kész.

Ezt érdemes szem előtt tartani PRD/architektúra tervezésnél: a CLAUDE.md részben **szándéknyilatkozat**, nem a jelen állapot.

## Kapcsolódó dokumentumok

- [Master index](./index.md) — belépőpont az egész dokumentációhoz
- [Source tree elemzés](./source-tree-analysis.md)
- [Adatmodell](./data-models.md)
- [Fejlesztői útmutató](./development-guide.md)
- [Deployment útmutató](./deployment-guide.md)
- [Integrációs architektúra](./integration-architecture.md)
- Meglévő domain-doksik: [architektura.md](./architektura.md), [ddd/model.md](./ddd/model.md), [ddd/glossary.md](./ddd/glossary.md), [stack.md](./stack.md), [system-prompt.md](./system-prompt.md), [brs-plantbase.md](./brs-plantbase.md)
