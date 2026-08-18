# Architektúra — `@plantbase/cli` (cli)

> Quick scan · 2026-07-17 · típus: CLI

## Összefoglaló

A CLI a `core` eredeti belépőpontja: parancssori interfész az agenthez. Vékony réteg — a logika a `@plantbase/core`-ban van.

## Technológiai stack

| Kategória | Technológia |
|-----------|-------------|
| CLI keret | `commander` |
| Interaktív | `readline` (Node beépített) |
| Env | `dotenv` |
| Függőség | `@plantbase/core` |

## Struktúra

```
apps/cli/src/
├── main.ts          # commander belépő (parancsok, flag-ek)
└── interactive.ts   # interaktív readline mód (argumentum nélkül)
```

## Parancsok (a CLAUDE.md alapján)

| Parancs | Leírás |
|---------|--------|
| `pnpm cli ask "…"` | egy kérdés → magyar válasz |
| `pnpm cli ask` | interaktív lekérdező mód |
| `pnpm cli ask --quiet "…"` | csak a végső válasz, live trace nélkül |
| `pnpm cli ingest "…"` | katalógus-szerkesztő agent (ír!); argumentum nélkül interaktív |

## Futtatás

```bash
pnpm cli ask "mutass 3 pet-safe növényt raktáron, 5000 Ft alatt"
```

**Dev-mód:** `tsx --conditions=@plantbase/source apps/cli/src/main.ts` — a `core` forrásból fut, build nélkül; a `core` szerkesztései azonnal hatnak. Fordított build: `pnpm cli:build` (`nx build cli`).
