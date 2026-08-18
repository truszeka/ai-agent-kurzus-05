# Ügyféloldali use case — megvalósítási terv

> **Forrás:** `docs/ugyfeloldali-use-case-terv.md`. A lépések checkbox (`- [x]`) szintaxissal követhetők.

**Cél:** Személyre szabott növénycsomag-ajánló emberi jóváhagyással. Az ügyfél webes űrlapon adja
meg a szoba adottságait és az igényeit; az agent a `products` katalógusból ajánlatot állít össze;
az ajánlat CSAK lakberendezői jóváhagyás után válik láthatóvá; az ügyfél ügyazonosítóval követi az
állapotot.

**Architektúra:** A meglévő Plantbase monorepóra épül, a `konvenciok.md` szerint.

```
apps/web  (React)         apps/server (Express)        packages/core
─────────────────         ─────────────────────        ────────────────────────────
igényfelmérő űrlap  ──►   POST /api/cases        ──►   cases/case-service.ts
státuszoldal        ──►   GET  /api/cases/:id           ├─ cases/case-store.ts (JSON)
ellenőrzőfelület    ──►   GET  /api/review/cases        ├─ cases/case-schema.ts
                          POST /api/review/cases/:id/decision
                          GET  /api/review/metrics ──►  agents/advisor-agent/
                                                          ├─ advisor-prompt.ts
                                                          └─ runSql (read-only)
```

**Tech stack:** TypeScript strict, Nx + pnpm, Vitest, Zod, Express 5, React 19 + Tailwind/shadcn,
Vercel AI SDK (`ai`) + `@ai-sdk/anthropic`. Ügytároló: **JSON fájl** (`data/cases.json`) — a terv 8.
pontja szerint elég egy egyszerű tároló, és így a `products` Postgres-katalógus érintetlen,
read-only marad.

## Globális megkötések

- A `products` tábla READ-ONLY marad; az agent továbbra is a `runSql` guardolt SELECT-jén megy.
- **Adatvédelem:** az ügyfél neve és e-mail-címe SOHA nem kerül a modellhez. Az agent csak a
  szoba-jellemzőket, preferenciákat és a büdzsét kapja meg (terv 8. pont).
- **Kötelező emberi kapu:** ajánlat csak `ajanlat_elkeszult` státuszban látható az ügyfélnek, és
  oda kizárólag lakberendezői jóváhagyással lehet eljutni. Az ügyféloldali végpont soha nem ad
  vissza jóváhagyatlan ajánlatot.
- Egy fogalom = egy könyvtár, minden hozzávalójával; a teszt a kód mellett (`*.spec.ts`).
- Minden tool/execute `ToolOutcome`-ot ad vissza és soha nem dob.
- Rendszer-határon Zod-validáció (HTTP body, LLM-kimenet, JSON fájl tartalma).
- Az LLM-kimenet megbízhatatlan: a strukturált ajánlás Zod-dal validált, hibás kimenet →
  eszkaláció, nem összeomlás.
- A `case-service` a recommendation-futtatót **injektálhatóan** kapja, hogy a teljes flow
  LLM és DB nélkül tesztelhető legyen.

---

### Task 1: Ügy-domain (`packages/core/src/lib/cases/`)

**Files:**

- Create: `packages/core/src/lib/cases/case-schema.ts`
- Create: `packages/core/src/lib/cases/case-store.ts`
- Create: `packages/core/src/lib/cases/case-store.spec.ts`

**Interfaces:** `CaseStatus`, `CaseIntake`, `CaseRecommendation`, `CaseRecord`, `createCase`,
`getCase`, `listCases`, `updateCase`.

- [x] **Step 1:** `case-schema.ts` — Zod sémák és típusok.
  - `CASE_STATUSES = ['beerkezett','feldolgozas_alatt','emberi_ellenorzesre_var','jovahagyva','ajanlat_elkeszult','modositasra_visszakuldve','elutasitva']`
  - `CaseIntakeSchema`: `customerName`, `customerEmail` (email), `roomType`, `light`, `spaceDescription`,
    `stylePreference`, `budgetHuf` (pozitív int), `specialRequests` (opcionális).
  - `CaseRecommendationSchema`: `items[] {name, latinName, priceHuf, reason}`, `totalPriceHuf`,
    `reasoning`, `warnings[]`, `confidence` (0..1), `escalationReason` (nullable).
  - `CaseRecordSchema`: intake + `caseId`, `createdAt`, `status`, `statusHistory[]`,
    `recommendation`, `agentSql[]`, `sqlErrorCount`, `sqlAttemptCount`, `reviewer*` mezők, időbélyegek.
  - `toCustomerView(record)`: az ügyfélnek szánt, szűrt nézet (ajánlat csak `ajanlat_elkeszult`-nál).

- [x] **Step 2:** `case-store.ts` — JSON-fájl tároló soros írással (egyszerű promise-lánc lock),
      `CASES_FILE` env vagy `data/cases.json`; olvasáskor Zod-validáció, sérült rekord kihagyása.

- [x] **Step 3:** `case-store.spec.ts` — ideiglenes fájlon: create → get → list → update,
      ismeretlen id, párhuzamos írás nem veszít rekordot.

---

### Task 2: Advisor agent (`packages/core/src/lib/agents/advisor-agent/`)

**Files:**

- Create: `packages/core/src/lib/agents/advisor-agent/advisor-prompt.ts`
- Create: `packages/core/src/lib/agents/advisor-agent/recommendation-parser.ts`
- Create: `packages/core/src/lib/agents/advisor-agent/recommendation-parser.spec.ts`
- Create: `packages/core/src/lib/agents/advisor-agent/advisor-agent.ts`

- [x] **Step 1:** `advisor-prompt.ts` — XML-szerű system prompt: `<role>`, `<task>`, `<schema>`,
      `<rules>`, `<escalation>`, `<output>`. Kimenet: EGYETLEN JSON objektum a séma szerint.
      Az eszkalációs lista a terv 4. pontjából; hatókörön kívüli kérés (rendelés, fizetés, reklamáció,
      jogi ügy) → `escalationReason`.
- [x] **Step 2:** `recommendation-parser.ts` — `parseRecommendation(text)`: ```json fence /
      első JSON-objektum kivágása → Zod-validáció → `{ ok, recommendation } | { ok: false, reason }`.
- [x] **Step 3:** `recommendation-parser.spec.ts` — tiszta JSON, fence-elt JSON, körítő szöveg,
      hibás/hiányos JSON, tartomány-hibás `confidence`.
- [x] **Step 4:** `advisor-agent.ts` — `runAdvisorAgent(intakeForModel)`: a közös `runAgentLoop`
      `runSql` toollal; a `ToolReporter`-rel gyűjti az SQL-kísérleteket és hibákat (mérési terv);
      visszaad `{ recommendation | null, escalationReason, sqlQueries, sqlAttemptCount, sqlErrorCount }`.
      Nem dob: LLM/DB hiba → eszkaláció.

---

### Task 3: Ügy-szolgáltatás (`packages/core/src/lib/cases/case-service.ts`)

**Files:**

- Create: `packages/core/src/lib/cases/case-service.ts`
- Create: `packages/core/src/lib/cases/case-service.spec.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1:** `submitCase(intake)` → rekord `beerkezett` státusszal, egyedi `caseId` (pl. `PB-XXXXXX`).
- [x] **Step 2:** `processCase(caseId, { runRecommendation })` → `feldolgozas_alatt` →
      agent → `emberi_ellenorzesre_var` (mindig, ez a kötelező kapu), eszkalációs ok rögzítése;
      büdzsé-túllépés / nulla találat → figyelmeztetés + eszkaláció.
- [x] **Step 3:** `decideCase(caseId, decision)` — `approve` (opcionális szerkesztéssel:
      `jovahagyva` → `ajanlat_elkeszult`), `revise` (→ `modositasra_visszakuldve`, majd újrafuttatás
      a lakberendező megjegyzésével), `reject` (→ `elutasitva`).
- [x] **Step 4:** `getCustomerView(caseId)` — jóváhagyás nélkül SOHA nem ad ajánlatot.
- [x] **Step 5:** `computeMetrics()` — tervezet-idő, jóváhagyásig eltelt idő, módosítás nélkül
      jóváhagyottak aránya, eszkalációs arány, SQL-hibaarány, büdzsén belüli arány.
- [x] **Step 6:** `case-service.spec.ts` — stub runner: happy path, eszkaláció, jóváhagyás előtt
      nincs ajánlat, revise → újrafuttatás, elutasítás, metrikák.
- [x] **Step 7:** exportok a `packages/core/src/index.ts`-ben.

---

### Task 4: HTTP végpontok (`apps/server`)

**Files:**

- Create: `apps/server/src/cases-routes.ts`
- Modify: `apps/server/src/main.ts`

- [x] **Step 1:** `POST /api/cases` — Zod-validált intake, azonnal visszaadja a `caseId`-t,
      a feldolgozás háttérben indul (fire-and-forget, hibája logolt).
- [x] **Step 2:** `GET /api/cases/:caseId` — ügyfélnézet (szűrt).
- [x] **Step 3:** `GET /api/review/cases?status=` — lakberendezői lista; `GET /api/review/cases/:id`
      — teljes nézet (eredeti kérés, generált SQL, ajánlat, indoklás, figyelmeztetések).
- [x] **Step 4:** `POST /api/review/cases/:id/decision` — `approve|revise|reject`.
- [x] **Step 5:** `GET /api/review/metrics`.
- [x] **Step 6:** `main.ts` — a router bekötése a meglévő `/api/chat` mellé.

---

### Task 5: Webes felületek (`apps/web`)

**Files:**

- Create: `apps/web/src/features/cases/intake-form.tsx`
- Create: `apps/web/src/features/cases/case-status.tsx`
- Create: `apps/web/src/features/cases/review-console.tsx`
- Create: `apps/web/src/features/cases/cases-api.ts`
- Modify: `apps/web/src/App.tsx`

- [x] **Step 1:** `cases-api.ts` — típusos fetch-kliens (`VITE_API_URL` figyelembevételével).
- [x] **Step 2:** Igényfelmérő űrlap → beküldés → ügyazonosító megjelenítése.
- [x] **Step 3:** Státuszoldal: ügyazonosítóval lekérdezés, státusz-idővonal, jóváhagyás után
      a csomag, teljes ár, rövid indoklás.
- [x] **Step 4:** Lakberendezői ellenőrzőfelület: várólista, részletek (kérés, SQL, ajánlat,
      indoklás, figyelmeztetések), jóváhagyás / visszaküldés / elutasítás, metrika-panel.
- [x] **Step 5:** `App.tsx` — egyszerű nézetváltó fül a meglévő chat mellé (nincs új router-függőség).

---

### Task 6: Dokumentáció és ellenőrzés

- [x] **Step 1:** `docs/ugyfeloldali-use-case-terv.md` 11. pontjának pontosítása (a kód már a repóban van).
- [x] **Step 2:** `README.md` — futtatási útmutató az új felületekhez.
- [x] **Step 3:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` zölden.

---

## Megvalósítás állapota (2026-08-18)

Minden task kész. Ellenőrzés: `pnpm test` (78 teszt, ebből 36 új), `pnpm typecheck`, `pnpm lint`,
`pnpm build` zölden; a HTTP-réteg végponti füstteszttel (beküldés → eszkaláció → lakberendezői
döntés → ügyfélnézet → metrikák) is ellenőrizve.

Eltérés a tervtől: a 6. task 1. lépése annyival bővült, hogy a `.gitignore` kizárja a
`data/` ügytárolót, a `.env.example` pedig dokumentálja a `CASES_FILE` változót.
