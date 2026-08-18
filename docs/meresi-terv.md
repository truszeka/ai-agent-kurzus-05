# Plantbase – mérési terv

**Use case:** személyre szabott növénycsomag-ajánló emberi jóváhagyással  
**Folyamatgazda:** vezető lakberendező  
**Technikai gazda:** e-commerce csapat  
**Mérési időszak:** 8 hetes pilot  
**Dátum:** 2026.08.18.

## 1. A mérés célja

A mérésnek azt kell eldöntenie, hogy a Plantbase gyorsabban és minden ügyfél számára képes-e személyre szabott növénycsomag-tervezetet készíteni anélkül, hogy az agent hibái ellenőrizetlenül eljutnának az ügyfélhez. A terv ezért egyszerre méri a gyorsaságot, az emberi munka mennyiségét, az ajánlat minőségét, az eszkalációt és az agent technikai hibáit.

A use case elsődlegesen a házi feladat 3. és 5. fájdalmához kapcsolódik:

- az új ügyfél strukturált segítséget és konkrét első ajánlatot kap;
- a személyre szabott kiszolgálás nem csak a legnagyobb ügyfeleknek jut.

## 2. Teljes mérési tábla

| Mit mérünk? | Definíció és célérték | Honnan lesz adat? | Hogyan riportáljuk? | Kinek? | Jelenlegi állapot / szükséges fejlesztés |
|---|---|---|---|---|---|
| Beérkezett ügyek száma | A pilotban beküldött összes ügy. Pilotcél: legalább 5 valós vagy élethű eset. | `data/cases.json`, egyedi `caseId`; a `computeMetrics().totalCases` értéke. | Heti darabszám és kumulált volumen az automatikus dashboardon. | Folyamatgazda; a pilot végén szponzor. | **Már létezik:** `/api/review/metrics`. |
| Ajánlattervezet elkészítési ideje | `draftReadyAt - createdAt`, átlag és medián. Sikerkritérium: az esetek legalább 90%-a 5 percen belül. | `CaseRecord.createdAt` és `draftReadyAt`; jelenleg `avgDraftSeconds`. | Heti átlag, medián és 90. percentilis; célértékhez viszonyított jelzés. | Folyamatgazda és technikai gazda. | **Részben létezik:** az átlag elérhető. A mediánt, 90. percentilist és az 5 percen belüli arányt hozzá kell adni a metrikákhoz. |
| Jóváhagyásig eltelt idő | `reviewedAt - draftReadyAt`; azt mutatja, mennyit vár a tervezet emberre. Pilotcél: munkaidőben medián 4 órán belül. | `draftReadyAt`, `reviewedAt` és `statusHistory`. A jelenlegi `avgApprovalSeconds` a teljes `createdAt - reviewedAt` időt számolja. | Heti medián és 90. percentilis, külön a munkaidőben beérkezett esetekre. | Folyamatgazda. | **Módosítandó:** a képletet a tervezet elkészülésétől kell számolni, és kezelni kell a munkaidőt. |
| Emberi ellenőrzési idő esetenként | A lakberendező aktív munkája az ellenőrzőfelületen. Baseline: 10–15 perc/szoba, becsült középérték 12,5 perc. Pilotcél: legfeljebb 5 perc/eset. | A baseline a BRS becslése; a pilothoz `reviewStartedAt` és `reviewedAt`, vagy indítás/leállítás esemény kell. | Heti átlag és medián; baseline–pilot összehasonlítás. | Folyamatgazda és szponzor. | **Még nincs naplózva:** review-kezdési időt vagy aktív időmérést kell beépíteni. A jelenlegi `savedReviewerMinutes = approvedCases × 25` csak ökölszám, nem mért megtakarítás. |
| Emberi módosítás nélkül jóváhagyott ajánlatok aránya | Nem módosított jóváhagyások / minden jóváhagyás. Pilotcél: legalább 70%. | `reviewerDecision === "approve"` és `reviewerModified`; `approvedWithoutEditRatio`. | Heti százalék, esetszámmal együtt. Kis mintánál nem csak a százalékot mutatjuk. | Folyamatgazda; havi összesítésben szponzor. | **Már létezik:** `/api/review/metrics`. Minőségi kontrollként a módosítás okát még kategorizálni kell. |
| Elutasítási arány | Elutasított esetek / minden ember által elbírált eset. Cél: legfeljebb 10%; minden elutasítást egyedileg ki kell vizsgálni. | `reviewerDecision`, `reviewerNote`; `rejectedCases` és `approvedCases`. | Heti arány, darabszám és rövid okkategória. | Folyamatgazda és technikai gazda. | **Részben létezik:** darabszám van; arányt és strukturált elutasítási okot hozzá kell adni. |
| Eszkalációs arány | `escalationReason` mezővel rendelkező esetek / minden eset. Nem önmagában a kisebb arány a cél: a helyes eszkaláció biztonsági siker. Kiinduló vizsgálati küszöb: 10–40%. | `CaseRecord.escalationReason`; `escalationRatio`. | Heti arány és ok szerinti bontás: nincs találat, kerettúllépés, alacsony confidence, SQL/LLM-hiba, scope-on kívüli kérés. | Folyamatgazda és technikai gazda; havi riportban szponzor. | **Részben létezik:** az összesített arány van. Az okkategóriát strukturált mezőként vagy riportlogikával kell hozzáadni. |
| SQL-hibaarány | Sikertelen SQL-kísérletek / minden SQL-kísérlet. Ez az agent egyik kötelező hibametrikája. Pilotcél: legfeljebb 5%. | `sqlErrorCount`, `sqlAttemptCount`; `sqlErrorRatio`; részletes SQL-nyom a `logs/<timestamp>.json` és `logs/agent.log` fájlokban. | Heti arány; minden hiba technikai kivizsgálási listára kerül. | Technikai gazda; heti összesítésben folyamatgazda. | **Már létezik:** `/api/review/metrics` és agentnapló. |
| Költségkereten belüli ajánlatok aránya | Olyan tervezetek aránya, ahol `totalPriceHuf <= budgetHuf`. Pilotcél: legalább 95%; a túllépésnek mindig figyelmeztetést és eszkalációt kell okoznia. | `recommendation.totalPriceHuf`, `intake.budgetHuf`; `withinBudgetRatio`. | Heti százalék; minden túllépéshez esetszintű ellenőrzés. | Folyamatgazda és technikai gazda. | **Már létezik:** `/api/review/metrics`; a guardrail automatikusan eszkalál. |
| Jóváhagyás nélkül látható ajánlatok száma | Biztonsági incidens: az ügyfél nem `ajanlat_elkeszult` státuszban nem-null ajánlatot kap. Cél: pontosan 0. | A `toCustomerView()` kimenete, API-integrációs teszt és hozzáférési napló. | Folyamatos automatikus teszt; incidens esetén azonnali riasztás és pilotstop. | Technikai gazda, folyamatgazda és szponzor. | **Részben létezik:** az üzleti szabály és unit teszt megvan. HTTP-hozzáférési naplót és automatikus riasztást kell beépíteni. |
| Ügyfél státuszlekérésének sikeressége | Sikeres státuszlekérések / minden státuszlekérés; ezzel mérjük, hogy az ügyfél valóban látja-e, hol tart az ügye. Pilotcél: legalább 99%. | `GET /api/cases/:caseId` HTTP-státuszkódjai és válaszideje. | Heti sikerességi arány és 95. percentilis válaszidő. | Technikai gazda; kiesésnél folyamatgazda. | **Még nincs naplózva:** HTTP request-metrikát kell beépíteni. |
| Ügyfél-elégedettség az ajánlattal | Egykérdéses, 1–5 skálás értékelés az ajánlat megtekintése után. Pilotcél: legalább 4,0 átlag, legalább 60%-os válaszadás mellett. | Új feedback mező vagy külön visszajelzési rekord az ügyazonosítóhoz kapcsolva. | A pilot közepén és végén átlag, eloszlás és szöveges okok. | Folyamatgazda és szponzor. | **Még nincs meg:** az ügyféloldali visszajelzési kontrollt és tárolást be kell építeni. |

## 3. Baseline és a számok minősítése

| Baseline | Érték | Minősítés | Forrás / teendő |
|---|---:|---|---|
| Esetszám | 5 ügyfél/hó, átlag 3 szoba; kb. 15 szoba/hó | **Becsült** | `docs/brs-plantbase.md`; a pilotban `totalCases` alapján ellenőrizendő. |
| Kézi munkaidő | 10–15 perc/szoba; számítási középérték 12,5 perc | **Becsült** | `docs/brs-plantbase.md`; a pilot első két hetében kézi időméréssel validálandó. |
| Ajánlat átfutási ideje | 1 munkanap | **Becsült** | A kitöltött use case felmérő feltételezése; a folyamatgazdával validálandó. |
| Hibaarány / újramunka | Nincs baseline | **Mérendő** | A pilotban a `reviewerModified`, `reviewerDecision` és okkategóriák alapján keletkezik. |
| Ügyfél-elégedettség | Nincs baseline | **Mérendő** | A pilotban bevezetendő egykérdéses visszajelzés szolgáltatja. |

A baseline becsléseit nem szabad mért tényként bemutatni. A pilot első két hete mérési szakasz: ekkor validáljuk a volument, a kézi munkaidőt és az átfutást, mielőtt a megtérülési számokat véglegesítjük.

## 4. Riportálási rend

| Gyakoriság | Tartalom | Formátum | Felelős | Címzett |
|---|---|---|---|---|
| Folyamatos | Kritikus hibák: jóváhagyási kapu sérülése, API-kiesés, sérült ügytár | Automatikus riasztás; a PoC után beépítendő | Technikai gazda | Technikai gazda és folyamatgazda |
| Heti | Volumen, tervezetkészítési idő, jóváhagyási idő, emberi munkaidő, módosítási arány, eszkaláció, SQL-hiba, kerettartás | Automatikus dashboard a `/api/review/metrics` adataiból, plusz egyoldalas megjegyzés az eltérésekről | Folyamatgazda | Pilotcsapat |
| 4. hét | Közbenső döntési mutatók és minden elutasított vagy kritikus eset | Egy vezetői dia és esetszintű melléklet | Folyamatgazda | Szponzor és technikai gazda |
| 8. hét | Teljes KPI-eredmény, baseline-összehasonlítás, ügyfél-visszajelzés, kockázatok, költség | Pilotzáró vezetői riport | Folyamatgazda | Szponzor és vezetői kör |

## 5. Döntési szabály a pilot végén

### Bővítés

A pilot bővíthető, ha mindegyik feltétel teljesül:

- legalább 5 értékelhető eset végigment;
- az ajánlattervezetek legalább 90%-a 5 percen belül elkészült;
- a lakberendező aktív ellenőrzési idejének mediánja legfeljebb 5 perc;
- legalább 70% emberi módosítás nélkül jóváhagyható volt;
- az SQL-hibaarány legfeljebb 5%;
- a kereten belüli ajánlatok aránya legalább 95%;
- egyetlen ajánlat sem vált láthatóvá emberi jóváhagyás nélkül;
- minden eszkaláció eljutott a lakberendezőhöz és visszakereshető.

### Feltételes folytatás

Ha nincs biztonsági incidens, de egy vagy több minőségi vagy hatékonysági cél nem teljesül, a pilot csak konkrét javítási tervvel és újraméréssel folytatható. Ilyenkor nem nyitjuk meg nagyobb ügyfélkörnek.

### Leállítás

A pilotot azonnal le kell állítani, ha jóváhagyatlan ajánlat jut el az ügyfélhez, személyes adat kerül a modellhez, az ügytár sérülése adatvesztést okoz, vagy az emberi eszkaláció nem működik.

## 6. A jelenlegi implementációhoz kötött adatforrások

- `packages/core/src/lib/cases/case-schema.ts`: `createdAt`, `draftReadyAt`, `reviewedAt`, `reviewerDecision`, `reviewerModified`, `escalationReason`, `sqlAttemptCount`, `sqlErrorCount`, `budgetHuf`, `totalPriceHuf`.
- `packages/core/src/lib/cases/case-service.ts`: a `computeMetrics()` aggregációi és a determinisztikus guardrailek.
- `data/cases.json`: az esetszintű forrásadat a PoC-ban.
- `GET /api/review/metrics`: a jelenleg rendelkezésre álló összesített metrikák.
- `logs/<timestamp>.json` és `logs/agent.log`: SQL-, tool-, modellhasználati és hibakivizsgálási nyom.

Az üzleti riport alapja az esetszintű `cases.json`, nem kizárólag az aggregált API-válasz. Ez biztosítja, hogy egy kiugró érték vagy hibás ajánlat az eredeti ügyig visszakövethető legyen.
