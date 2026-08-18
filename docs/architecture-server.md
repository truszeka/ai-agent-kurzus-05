# Architektúra — `@plantbase/server` (server)

> Quick scan · 2026-07-17 · típus: backend

## Összefoglaló

Express-alapú **chat-szerver**, amely a webes UI-t (`@plantbase/web`) szolgálja ki: a `@plantbase/core` `askAgent`-jét hívja, és a választ (várhatóan streamelve, az `ai` SDK-val) továbbítja a kliensnek.

## Technológiai stack

| Kategória | Technológia |
|-----------|-------------|
| HTTP keret | `express` |
| CORS | `cors` |
| LLM streaming | `ai` (Vercel AI SDK 6) |
| Env | `dotenv` |
| Függőség | `@plantbase/core` |
| Típusok | `@types/express`, `@types/cors` |

## Struktúra

```
apps/server/src/
└── main.ts    # Express app, CORS, chat endpoint(ok), a core-t hívja
```

> Quick scan: a route-ok pontos listáját a forrás olvasása nélkül nem soroljuk fel. A `main.ts` egyetlen belépőpont; a chat-endpoint az `ai` SDK streaming-protokollját használja a `@ai-sdk/react` klienshez.

## Futtatás

```bash
pnpm server     # tsx --conditions=@plantbase/source apps/server/src/main.ts
```

**Nincs külön build lépés** — a szerver forrásból fut `tsx`-szel (lásd [railpack.api.json](../railpack.api.json)).

## Deploy

Railpack (`railpack.api.json`): build helyett közvetlen `tsx` start:
```
node_modules/.bin/tsx --conditions=@plantbase/source apps/server/src/main.ts
```

## Kapcsolódás

A szerver a `web` frontend backendje. A `core` chat-útvonala az `ORCHESTRATION_MODE` env-től függ (`off` = jelenlegi egy-agentes út). Lásd [integration-architecture.md](./integration-architecture.md).
