# Source tree elemzés

> Generálva: 2026-07-17 · quick scan (mintázat-alapú) · a fákat a tényleges fájlrendszerből.

## Gyökér

```
ai-agent-kurzus-03/
├── apps/                     # Alkalmazások (belépőpontok)
│   ├── cli/                  # @plantbase/cli   — CLI (commander + readline)
│   ├── server/               # @plantbase/server — Express chat-szerver
│   └── web/                  # @plantbase/web    — React + Vite chat-UI
├── packages/                 # Könyvtárak (framework-agnosztikus mag)
│   ├── core/                 # @plantbase/core   — agent-logika, tool-ok, trace
│   └── db/                   # @plantbase/db     — Prisma séma, migráció, seed, generált kliens
├── docker/                   # Postgres initdb scriptek (RO szerepkör létrehozása)
├── docker-compose.yml        # Lokális Postgres (host port 5433)
├── seed/                     # Katalógus seed adat + knowledge (plants.ts, seed.ts)
├── docs/                     # Ez a dokumentáció + domain-doksik (DDD, konvenciók)
├── nx.json                   # Nx workspace konfiguráció
├── pnpm-workspace.yaml       # pnpm workspace tagok
├── tsconfig.base.json        # Közös TS beállítások (@plantbase/source condition)
├── vitest.workspace.ts       # Vitest workspace
├── railpack.api.json         # Deploy: szerver (tsx, source-mode)
├── railpack.web.json         # Deploy: web (nx build → serve)
└── .github/workflows/        # CI (ci.yml) + Claude review (claude-review.yml)
```

## `packages/core` — az agent mag (belépőpont: `src/index.ts`)

```
packages/core/src/
├── index.ts                          # Publikus export felület
└── lib/
    ├── config.ts                     # Env-validáció Zod-dal (fail-fast): API kulcs, model, RO DB URL
    ├── trace.ts                      # Átlátszó per-lépés trace (console + logs/<ts>.json + agent.log)
    ├── echo.ts                       # Pedagógiai "0. réteg" (echo)
    ├── user-role/user-role.ts        # Felhasználói szerepkör
    ├── agents/
    │   ├── agent-loop.ts             # Közös loop: generateText + stopWhen: stepCountIs(n)
    │   ├── query-agent/
    │   │   ├── query-agent.ts        # askAgent — NL → SQL → runSql → magyar válasz
    │   │   └── query-prompt.ts       # buildQueryPrompt (XML-tagolt system prompt)
    │   └── ingest-agent/
    │       ├── ingest-agent.ts       # askIngestAgent — katalógus szerkesztése (ír!)
    │       └── ingest-prompt.ts      # buildIngestPrompt
    └── tools/
        ├── tool-outcome.ts           # Közös eredmény-shape (content, isError, summary, rowCount)
        ├── run-sql/
        │   ├── run-sql-tool.ts       # A read-only SQL tool
        │   ├── sql-guard.ts          # Csak SELECT/WITH…SELECT, 1 utasítás, kötelező LIMIT
        │   └── db-readonly.ts        # START TRANSACTION READ ONLY pg kapcsolat
        ├── get-client-preferences/   # get-client-preferences-tool.ts
        ├── fetch-feed/               # fetch-feed-tool.ts + shopify-feed.ts (Shopify products.json)
        ├── upsert-product/           # upsert-product-tool.ts + product-schema.ts + db-readwrite.ts (az EGYETLEN in-app író út)
        └── delegate-to-ingest/       # delegate-to-ingest-tool.ts
```

**Konvenció:** egy tool = egy könyvtár mindennel, ami kell hozzá; a fájlnév hordozza a fajtát (`*-tool.ts`, `*-agent.ts`, `*-prompt.ts`). 9 `*.spec.ts` teszt kíséri a magot (Vitest).

## `packages/db` — adatréteg

```
packages/db/
├── prisma/
│   ├── schema.prisma                 # Jelenleg 1 modell: Product
│   ├── migrations/20260629155056_init_products/
│   └── seed.ts                       # prisma db seed belépő
└── generated/client/                 # Generált Prisma kliens (postinstall: prisma generate)
```

## `apps/*` — belépőpontok

```
apps/cli/src/
├── main.ts                           # commander belépő (ask / ingest parancsok)
└── interactive.ts                    # interaktív readline mód

apps/server/src/
└── main.ts                           # Express + CORS, streaming chat endpoint (a core askAgent-jét hívja)

apps/web/src/
├── main.tsx                          # React belépő
├── App.tsx                           # Chat felület (@ai-sdk/react)
├── components/ui/                    # button.tsx, input.tsx, message-scroller.tsx (shadcn/radix)
├── lib/utils.ts                      # cn() segéd (clsx + tailwind-merge)
└── styles.css                        # Tailwind
```

## Belépőpontok összefoglaló

| Rész | Belépőpont | Futtatás |
|------|-----------|----------|
| cli | `apps/cli/src/main.ts` | `pnpm cli ask "…"` |
| server | `apps/server/src/main.ts` | `pnpm server` |
| web | `apps/web/src/main.tsx` | `pnpm web` (Vite dev) |
| core | `packages/core/src/index.ts` | könyvtárként importálva |
| db | `packages/db/prisma/schema.prisma` | `pnpm db:*` scriptek |

**Dev vs. build feloldás:** a `@plantbase/source` export-condition a `./src/index.ts`-re mutat; a `pnpm cli`/`pnpm server` `tsx --conditions=@plantbase/source`-szal fut, így a `core` **forrásból, build nélkül** él. A tesztek és az `nx build` a fordított `./dist`-et használják.
