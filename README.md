# 🌱 Plantbase

> AI agent, amely a természetes nyelvű kérdést **SQL-re fordítja** egy növény-katalógus (`products`) felett, **read-only** lefuttatja, és **természetes nyelvű választ** ad. Önkiszolgáló analitika SQL-tudás nélkül.

A persona egy **lakberendező**, aki a szobák adottságai (fény, méret), az ügyfél igényei és a büdzsé alapján állít össze növénycsomagot. Az adat megvan, de a kinyerése SQL-tudást igényelne — a Plantbase ezt automatizálja.

A projekt egy AI-agent kurzus kísérleti repója: a cél, hogy az agent mechanikája **az alapoktól, rétegről rétegre** látszódjon (echo → LLM → SQL-es tool), agent-framework nélkül.

**Három belépési pont, egy agent-mag:**

| Belépés                         | Kinek                 | Mit ad                                                                   |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| **CLI** (`pnpm cli ask`)        | fejlesztő, demó       | a teljes mechanika élő trace-szel, rétegről rétegre                      |
| **Katalógus-chat** (web)        | bárki                 | ugyanaz a kérdés-válasz, böngészőből, streamelve                         |
| **Ügyféloldali use case** (web) | ügyfél + lakberendező | igényfelmérő → agent-tervezet → **kötelező emberi jóváhagyás** → ajánlat |

---

## Hogyan működik?

```
felhasználó kérdése
        │
        ▼
   apps/cli   ─────┐
  (commander,      ├──►  packages/core  (askAgent / askIngestAgent / runAdvisorAgent)
   readline)       │      │
   apps/web  ──►   │      │  1. system prompt (séma + szabályok, XML-tagolt)
   apps/server ────┘      │  2. streamText (Vercel AI SDK)  ◄── stopWhen:
   (Express)              │  3. a modell SQL-t ír  ──► runSql tool     stepCountIs(n)
                          │  4. SELECT-guard + READ-ONLY kapcsolat ──► Postgres (products)
                          │  5. sorok ──► a modell magyar választ ad
                          ▼
            természetes nyelvű válasz  +  élő színes trace
                          +  logs/<timestamp>.json  +  logs/agent.log
```

A `packages/core` **framework-agnostic**: nem ismeri a belépési pontot (CLI/API/web). Az agent a **Vercel AI SDK 6**-ra épül (`streamText` + `stopWhen: stepCountIs(n)`): a prompt → tool-hívás → tool-eredmény → ismétlés ciklust az SDK futtatja, de a lépésenkénti átláthatóságot a saját trace-rétegünk adja (`prepareStep`/`onStepFinish` → trace.ts). A loop eredetileg kézzel íródott a nyers Anthropic SDK fölé — a tananyag ezt a fejlődést követi.

**Egy agent = prompt + toolok + loop.** A közös loop az `agents/agent-loop.ts`; minden agent egy
vékony definíció a saját könyvtárában:

| Agent   | Hol                     | Mit csinál                                              | Tooljai                                |
| ------- | ----------------------- | ------------------------------------------------------- | -------------------------------------- |
| query   | `agents/query-agent/`   | NL → SQL → magyar válasz                                | `runSql`, `getClientPreferences`       |
| ingest  | `agents/ingest-agent/`  | katalógus-szerkesztés (az egyetlen írási út)            | `fetchFeed`, `runSql`, `upsertProduct` |
| rag     | `agents/rag-agent/`     | gondozási kérdések a tudásbázisból                      | `searchKnowledge`                      |
| advisor | `agents/advisor-agent/` | ügyfél-igényből csomag**tervezet** (JSON, Zod-validált) | `runSql`                               |

---

## Háromrétegű read-only védelem (NFR1)

Az agent **soha nem módosítja az adatot**. Három, egymástól független réteg gondoskodik erről:

1. **DB-szerepkör** — a `runSql` a `plantbase_ro` (csak `SELECT`) szerepkörön fut, ami fizikailag sem tud írni.
2. **SELECT-guard** — a generált SQL-t a `core/sql-guard` ellenőrzi: csak `SELECT`/`WITH … SELECT`, egyetlen utasítás, kötelező `LIMIT`.
3. **Read-only tranzakció** — minden lekérdezés `START TRANSACTION READ ONLY`-ban fut.

A Prisma (séma, migráció, seed) ezzel szemben a **READ-WRITE** kapcsolatot használja — két DB-URL, két jog.

---

## Tech stack

| Réteg          | Eszköz                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| Monorepo       | Nx 23, pnpm workspaces, TypeScript (strict), Node LTS                        |
| Agent          | Vercel AI SDK 6 (`streamText` + `stopWhen: stepCountIs`) + saját trace-réteg |
| Validáció      | Zod (rendszer-határokon)                                                     |
| CLI            | commander + `node:readline`                                                  |
| API            | Express 5 (`/api/chat` streamelve + ügy-végpontok)                           |
| Web            | Vite + React 19, Tailwind 4, shadcn/ui, `@ai-sdk/react` (useChat)            |
| Adatbázis      | PostgreSQL 17 (docker-compose, OrbStack), `pg` (read-only)                   |
| ORM / migráció | Prisma 6 (séma, migráció, seed)                                              |
| Tooling        | Vitest, ESLint, Prettier, tsx                                                |

---

## Projektstruktúra

```
.
├── apps/
│   ├── cli/                 # plantbase CLI: ask / ingest / knowledge-ingest
│   ├── server/              # Express API: /api/chat + cases-routes.ts (ügy-végpontok)
│   └── web/
│       └── src/features/    # chat/ (katalógus-chat) + cases/ (űrlap, státusz, ellenőrzés)
├── packages/
│   ├── core/                # agent-logika (framework-agnostic)
│   │   └── src/lib/
│   │       ├── agents/      # agent-loop.ts + query- / ingest- / rag- / advisor-agent könyvtárak
│   │       ├── tools/       # egy tool = egy könyvtár (run-sql, upsert-product, search-knowledge, …)
│   │       ├── cases/       # az ÜGY: séma, JSON-tároló, életút (case-service.ts)
│   │       ├── user-role/   # szerep-alapú képesség-kapcsolás (customer / admin)
│   │       └── *.ts         # config.ts (Zod env-validáció), trace.ts (élő nyom + JSON log)
│   └── db/                  # Prisma: séma (products, knowledge_chunks), migráció, seed, generált kliens
├── seed/knowledge/          # tudásbázis-cikkek a `pnpm cli knowledge-ingest`-hez
├── data/cases.json          # az ügytároló (futásidejű, nincs verziózva)
├── docs/                    # BRS, architektúra, stack, konvenciók, system-prompt, use case terv
├── docker-compose.yml       # Postgres + read-only role (initdb)
└── .env.example             # két DB-kapcsolat (RW/RO) + Anthropic kulcs/model
```

---

## Előfeltételek

- Node LTS, **pnpm** (`corepack enable`)
- **Docker** (OrbStack a Postgreshez)
- `psql` (opcionális, kézi ellenőrzéshez)
- **Anthropic API-kulcs**
- OpenAI + Cohere kulcs — **csak a RAG-úthoz** (a katalógus-kérdésekhez és az ügyféloldali use case-hez nem kell)

## Indulás

```bash
# 1. Függőségek (a postinstall lefuttatja a `prisma generate`-et)
pnpm install

# 2. Környezeti változók — másold és töltsd ki az ANTHROPIC_API_KEY-t
cp .env.example .env

# 3. Postgres indítása (a read-only role-t az initdb hozza létre)
docker compose up -d

# 4. Séma + kész seed (~30 növény) betöltése
pnpm db:migrate        # products + knowledge_chunks migrációk
pnpm db:seed           # idempotens: 30 növény
```

> A Postgres a **host 5433-as porton** fut (a 5432-t gyakran foglalja másik projekt) — lásd `docker-compose.yml` és `.env.example`.

> Ha a `pnpm db:migrate` azt írja, hogy _„The migration … was modified after it was applied"_,
> a fejlesztői adatbázis sémája elcsúszott a migrációs fájloktól. Fejlesztői DB-ben a megoldás
> `pnpm db:reset` (dob + migrál + seedel — **az adat elvész**, ezért előbb nézd meg, van-e benne
> érték). Már alkalmazott migrációs fájlt ne szerkessz: vegyél fel újat.

## Használat

```bash
# Egyszeri kérdés
pnpm cli ask "mutass 3 pet-safe, alacsony fényigényű növényt raktáron, 5000 Ft alatt"

# Interaktív mód (több kérdés, 'exit'-ig)
pnpm cli ask

# Csendes mód: csak a végső válasz, élő trace nélkül (a JSON nyom akkor is elkészül)
pnpm cli ask --quiet "milyen pozsgásokat ajánlasz?"

# Katalógus-szerkesztő agent (ÍR az adatbázisba); argumentum nélkül interaktív
pnpm cli ingest "hozd be a tropicalhome feed új pozsgásait"

# Súgó
pnpm cli --help
```

Minden interakció **kétféleképpen átlátható**:

- **Élő színes trace** a konzolon — lépésről lépésre látszik a teljes mechanika: a kérés paraméterei (model, max_tokens, tools, system, messages), a modell generálta SQL, a tool-eredmény és a végső válasz. (`--quiet`-tel kikapcsolható.)
- **Pretty JSON nyom** minden futásról: `logs/<timestamp>.json` (system prompt, üzenetek, **generált SQL**, eredmény, válasz, token-felhasználás).
- **Folyamatos „control room" log** a `logs/agent.log`-ban — külön terminálban `tail -f logs/agent.log`-gal követhető, a `--quiet`-tól függetlenül.

A modell `.env`-ből állítható (`ANTHROPIC_MODEL`); költségérzékeny demóhoz pl. `claude-haiku-4-5`.

---

## Ügyféloldali use case — növénycsomag-ajánló emberi jóváhagyással

Az ügyfél webes űrlapon megadja a szoba adottságait és az igényeit; az agent a katalógusból
csomagtervezetet állít össze; a tervezet **csak lakberendezői jóváhagyás után** válik láthatóvá.
(Terv: `docs/ugyfeloldali-use-case-terv.md`, lépéssor: `docs/superpowers/plans/2026-08-18-ugyfeloldali-use-case.md`.)

```bash
pnpm server   # API (3001) — az ügy-végpontokkal együtt
pnpm web      # UI (4200)
```

A `http://localhost:4200` négy fület kínál:

| Fül            | Kinek        | Mit csinál                                                                 |
| -------------- | ------------ | -------------------------------------------------------------------------- |
| Igényfelmérő   | ügyfél       | szoba + igények beküldése, **ügyazonosító** (pl. `PB-7QK3ZA`)              |
| Ügyem állapota | ügyfél       | státusz-idővonal, jóváhagyás után a csomag, teljes ár, indoklás            |
| Ellenőrzés     | lakberendező | várólista, eredeti kérés, generált SQL, tervezet, figyelmeztetések, döntés |
| Katalógus-chat | bárki        | a korábbi kérdés-válasz felület (query-agent)                              |

Az ügy életútja: `Beérkezett → Feldolgozás alatt → Emberi ellenőrzésre vár → Jóváhagyva →
Ajánlat elkészült` (illetve `Módosításra visszaküldve` / `Elutasítva`).

**Végpontok**

| Metódus | Útvonal                              | Kinek                                                        |
| ------- | ------------------------------------ | ------------------------------------------------------------ |
| `POST`  | `/api/cases`                         | ügyfél — igény beküldése                                     |
| `GET`   | `/api/cases/:caseId`                 | ügyfél — szűrt státusz (jóváhagyatlan ajánlat sosem megy ki) |
| `GET`   | `/api/review/cases?status=`          | lakberendező — várólista                                     |
| `GET`   | `/api/review/cases/:caseId`          | lakberendező — teljes nézet                                  |
| `POST`  | `/api/review/cases/:caseId/decision` | lakberendező — `approve` / `revise` / `reject`               |
| `GET`   | `/api/review/metrics`                | mérési terv metrikái                                         |

**Amit a demó garantál**

- Az ügyfél neve és e-mail-címe **nem kerül a modellhez** — csak a szoba, a preferenciák és a keret.
- Minden ügy emberi ellenőrzésre áll meg; jóváhagyás nélkül nincs ajánlat az ügyféloldalon.
- Bizonytalanság (hiányzó adat, nincs találat, keret nem tartható, hibás SQL, hatókörön kívüli
  kérés) → **eszkalációs ok** a lakberendezőnek, nem kitalált ajánlat.

Az ügyek egy egyszerű JSON fájlban élnek (`data/cases.json`, a `CASES_FILE` env-vel átállítható);
a `products` katalógus továbbra is read-only Postgres.

---

## Hasznos scriptek

| Script                         | Mit csinál                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| `pnpm cli ask "…"`             | CLI futtatása tsx-szel (nincs build futásonként)                        |
| `pnpm cli ingest "…"`          | katalógus-szerkesztő agent (ír az adatbázisba)                          |
| `pnpm cli knowledge-ingest`    | tudásbázis-cikkek darabolása + vektorizálása a knowledge_chunks táblába |
| `pnpm server`                  | Express API dev-módban (port 3001)                                      |
| `pnpm web`                     | Vite dev-szerver a webes felületekhez (port 4200)                       |
| `pnpm db:migrate`              | Prisma migráció (dev)                                                   |
| `pnpm db:seed`                 | Seed betöltése (idempotens)                                             |
| `pnpm db:reset`                | **destruktív**: drop + migrate + seed                                   |
| `pnpm db:studio`               | Prisma Studio (localhost:5555)                                          |
| `pnpm build`                   | minden projekt buildje (`nx run-many -t build`)                         |
| `pnpm test`                    | Vitest (unit tesztek)                                                   |
| `pnpm lint` / `typecheck`      | ESLint / `tsc`                                                          |
| `pnpm format` / `format:check` | Prettier (ír / csak ellenőriz)                                          |

---

## RAG Pipeline

A `pnpm cli knowledge-ingest` betölti a `seed/knowledge/` gondozási cikkeket a `knowledge_chunks`
pgvector táblába. Ha a tudásbázis be van töltve, a `pnpm cli ask "..."` automatikusan a
**RAG-agentet** hívja (HyDE + embedding + Cohere rerank + grounded, forrás-hivatkozásos válasz);
üres tudásbázisnál változatlanul a meglévő SQL-agentre esik vissza. Előfeltétel a RAG-úthoz:
`OPENAI_API_KEY` és `COHERE_API_KEY` a `.env`-ben.

### Multi-provider szereposztás

| Feladat          | Provider  | Modell                               | Indoklás                                                             |
| ---------------- | --------- | ------------------------------------ | -------------------------------------------------------------------- |
| Válasz-generálás | Anthropic | (a `config.ts` `ANTHROPIC_MODEL`-je) | Már integrált, magyar szöveg, XML-tag prompt                         |
| HyDE document    | Anthropic | `claude-haiku-4-5-20251001`          | Olcsóbb, csak rövid hipotetikus doc kell                             |
| Embedding        | OpenAI    | `text-embedding-3-small`             | Anthropic nem ad embedding API-t; legolcsóbb stabil opció (dim=1536) |
| Rerank           | Cohere    | `rerank-english-v3.0`                | Dokumentált rerank API, kurzus-követelmény                           |

### Chunking stratégia — B (szekció-alapú)

A 202 gondozási cikk Markdown `##`/`###` headingek mentén kerül szétbontásra (target: 120 szó,
max: 250 szó, 1 mondatos overlap). Indoklás: a cikkek heading-struktúráltak (minden cikknél van
`##`), a szekciók természetes szemantikai határokat képeznek (pl. „Watering", „Light
Requirements"), és az overlap csökkenti a határon elveszett kontextust. Fejléc nélküli cikknél
bekezdés-alapú fallback lép életbe.

### Költségbecslés

> Töltsd ki a saját futtatásod számaival (`pnpm cli knowledge-ingest` és egy `ask` futtatás után).
> Nagyságrendi becslés:

**Ingest (202 dokumentum, ~_XXXX_ chunk):**

- Embedding: ~_XXXX_ token × $0.02/1M = ~$_X.XX_

**Egy kérdés (teljes pipeline):**

- HyDE generálás (haiku): ~300 token output ≈ $0.00X
- Embedding (1 kérdés): ~50 token ≈ $0.000001
- Cohere rerank (top-20): ~$0.001
- Válasz-generálás (sonnet): ~800 token input + ~300 output ≈ $0.00X
- **Összesen egy kérdés: ~$0.00X–0.0X**

Részletek: a golden set eredménye a [`docs/golden-set.md`](docs/golden-set.md)-ben, a tudásbázis-
karbantartási terv a [`docs/tudasbazis-karbantartas.md`](docs/tudasbazis-karbantartas.md)-ben.

---

## A három implementációs fázis

A működés rétegről rétegre épül (lásd `docs/proposal-implementacio.md`):

1. **CLI echo** — a CLI visszaírja a bemenetet (még nincs LLM, nincs DB).
2. **LLM, DB nélkül** — sima `messages.create`; adat-kérdésnél az agent **őszintén jelzi**, hogy nincs adatbázis-hozzáférése, és nem talál ki adatot.
3. **SQL-es interakció** — a `runSql` toollal a kérdésből SQL lesz, read-only lefut, és valós, természetes nyelvű választ kapsz.

---

## Dokumentáció

A részletek a [`docs/`](docs/) mappában:

- [`brs-plantbase.md`](docs/brs-plantbase.md) — üzleti követelmények (BRS), ROI, scope
- [`architektura.md`](docs/architektura.md) — fájlstruktúra és kulcsdöntések
- [`stack.md`](docs/stack.md) — tech stack és a `products` séma
- [`setup-instructions.md`](docs/setup-instructions.md) — lépésről lépésre környezet-felállítás
- [`konvenciok.md`](docs/konvenciok.md) — kódkonvenciók, prompt-stílus
- [`system-prompt.md`](docs/system-prompt.md) — a termék-agent system promptja
- [`dev-workflow.md`](docs/dev-workflow.md) — git, hookok, dokumentáció
- [`golden-set.md`](docs/golden-set.md) — RAG golden set (raw vs. rerank), negatív teszt
- [`tudasbazis-karbantartas.md`](docs/tudasbazis-karbantartas.md) — RAG index inkrementális karbantartás
- [`ugyfeloldali-use-case-terv.md`](docs/ugyfeloldali-use-case-terv.md) — az ügyféloldali use case (folyamat, emberi kapu, metrikák)
- [`demo-forgatokonyv.md`](docs/demo-forgatokonyv.md) — a sikeres és eszkalációs PoC-demó lépésről lépésre
- [`meresi-terv.md`](docs/meresi-terv.md) — teljes mérési tábla, adatforrások, riportálás és pilotdöntés
- [`kerdeslap.md`](docs/kerdeslap.md) — a hat kötelező és két saját vezetői kérdés megválaszolva
- [`hf5-business-case.pptx`](docs/hf5-business-case.pptx) — döntéselőkészítő prezentáció a vezetői körnek (8 dia: adattérkép, mérési terv, rollout); forrása: [`scripts/build-hf5-deck.js`](scripts/build-hf5-deck.js)
- [`superpowers/plans/2026-08-18-ugyfeloldali-use-case.md`](docs/superpowers/plans/2026-08-18-ugyfeloldali-use-case.md) — a use case megvalósítási lépéssora
- [`ddd/model.md`](docs/ddd/model.md) · [`ddd/glossary.md`](docs/ddd/glossary.md) — domain-modell és egységes nyelv
- [`proposal-implementacio.md`](docs/proposal-implementacio.md) — a fázisolt implementációs terv
