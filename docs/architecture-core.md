# Architektúra — `@plantbase/core` (core)

> Quick scan · 2026-07-17 · típus: library (framework-agnosztikus)

## Összefoglaló

A `core` a rendszer szíve: **framework-agnosztikus agent-logika**, amely nem ismeri a belépőpontját (CLI/API/web). Szándékosan **nincs agent-framework** — a mechanika rétegről rétegre látszik.

## Technológiai stack

| Kategória | Technológia | Megjegyzés |
|-----------|-------------|------------|
| LLM SDK | `ai` (Vercel AI SDK 6), `@ai-sdk/anthropic` | `generateText` + `stopWhen: stepCountIs(n)` |
| DB kliens | `pg` | közvetlen read-only kapcsolat (nem Prisma!) |
| Validáció | `zod` | szigorú tool-input határvalidáció |
| Segéd | `tslib` | |

## Architektúra minta

**Prompt + tool-ok + loop.** A közös loop (`agents/agent-loop.ts`) futtatja a prompt → tool-hívás → tool-eredmény → ismétlés ciklust, átlátszó per-lépés trace-szel (`trace.ts`: live console + `logs/<ts>.json` + `logs/agent.log`). Minden agent vékony definíció: prompt + toolset + limitek.

### Implementált agentek

- **Query agent** (`agents/query-agent/`) — `askAgent`: NL → SQL → read-only `runSql` → magyar válasz. Tool-ok: `runSql`, `getClientPreferences`.
- **Ingest agent** (`agents/ingest-agent/`) — `askIngestAgent`: a katalógust szerkeszti. Tool-ok: `fetchFeed` (Shopify `products.json`), `runSql` (olvasás), `upsertProduct` (az egyetlen in-app író út).

> **Nincs még implementálva** (a CLAUDE.md említi): `orchestrator-agent`, `package-agent`, router/delegate handover. A `delegate-to-ingest` tool megvan, de a teljes orchestráció még hiányzik.

## Tool-réteg

Egy tool = egy könyvtár mindennel, ami kell hozzá; a közös `ToolOutcome` egy szinttel feljebb (`tools/tool-outcome.ts`). A tool-fájl tartalmazza: model-facing leírás, permisszív AI SDK `tool()` séma, szigorú Zod-validáció az `execute*`-ban, és a `<name>Tool(report)` factory. Az `execute*` **soha nem dob** — mindig `ToolOutcome`-ot ad vissza (magyar hibaszöveg).

| Tool | Könyvtár | Szerep |
|------|----------|--------|
| `runSql` | `tools/run-sql/` | read-only SQL (`run-sql-tool.ts` + `sql-guard.ts` + `db-readonly.ts`) |
| `getClientPreferences` | `tools/get-client-preferences/` | ügyfél-preferenciák |
| `fetchFeed` | `tools/fetch-feed/` | Shopify feed kliens (`shopify-feed.ts`) |
| `upsertProduct` | `tools/upsert-product/` | egyetlen író út (`product-schema.ts` + `db-readwrite.ts`) |
| `delegateToIngest` | `tools/delegate-to-ingest/` | ingest agent delegálás |

## Biztonság (NFR1) — read/write szétválasztás

A lekérdező út **soha nem írhat**. Három réteg: (1) `plantbase_ro` szerepkör (SELECT-only), (2) `sql-guard.ts` (csak `SELECT`/`WITH…SELECT`, 1 utasítás, kötelező `LIMIT`), (3) `START TRANSACTION READ ONLY` (`db-readonly.ts`). Írás csak `upsertProduct`-on át, külön read-write pg pool-on (`db-readwrite.ts`), szigorú Zod-validációval, `latin_name`-re kulcsolt idempotens upsert.

## Konfiguráció

`config.ts` — env-validáció Zod-dal (fail-fast): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DATABASE_URL_READONLY`. A read-write `DATABASE_URL`-t **lokálisan** a `db-readwrite.ts` validálja (nem a közös configban), hogy a query agent ne igényelje.

## Belépőpont

`src/index.ts` — publikus export. Dev-módban a `@plantbase/source` condition a forrásra mutat (build nélkül fut).

## Tesztelés

9 `*.spec.ts` (Vitest), pl. `sql-guard.spec.ts`, `run-sql` guard-tesztek. Futtatás: `pnpm nx test @plantbase/core`.
