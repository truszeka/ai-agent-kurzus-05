# Házifeladat (HF3)

## RAG a saját use case-edre

Építs egy működő RAG-pipeline-t — saját tudásbázis, saját chunking-stratégia, teljes keresési pipeline (HyDE + rerank), grounding — és egy külön architektúra-speciﬁkációt arról, hogyan tartanád karban a tudásbázist.

Az órán a Plantbase-en láttad az összes építőelemet — egyszerű mintaként. A házi célja a végiggondolt megoldás: a döntések a tiéid, az indoklás is a tiéd.

## 1. Use case és tudásbázis

Két út közül választhatsz:

### A) Saját use case

Válassz egy témát, amihez van vagy össze tudsz rakni egy tudásbázist:

- minimum 20–30 dokumentum, összesen legalább ~15 000 szó, több altémával
- legális forrásból (publikus, crawlelhető tartalom, saját dokumentumok, céges anyag amit megoszthatsz)
- bármilyen formátum, ami szöveggé alakítható (markdown, HTML, PDF)

A lényeg: te ismerd a domaint — mert az értékeléskor azt nézzük, jók-e a találatok, és ezt neked kell tudnod megítélni.

### B) A Plantbase továbbvitele

Ha nem akarsz saját use case-t keresni, viheted tovább a Plantbase-t: a tudásbázis adott (a 202 gondozási cikk a kurzus-repóban). Ilyenkor a cél a végiggondolt megoldás implementálása az órán látott egyszerű minta alapján — nem az órai branch lemásolása. Konkrétan:

- saját implementáció, a saját döntéseiddel — az órai kód referencia, nem sablon
- a chunking-stratégiát fejleszd tovább (lásd a 2. pontot) — az órai megoldás direkt túlegyszerűsített
- a többi leadandó (golden set, negatív teszt, architektúra-spec, routing-indoklás, költségbecslés) itt is a te munkád — ezek az órai anyagban nincsenek benne

Az értékelésnél a két út egyenrangú — a B) opciónál az indoklások és az elemzés súlya nagyobb, mert a tudásbázis-építést megspóroltad.

Bármelyik utat választod, a HF1-es házidat továbbviheted: dolgozhatsz ugyanabban a repóban — a RAG-réteg épülhet a meglévő agentedre.

## 2. Chunking-stratégia — és az indoklás

Az órán látott bekezdés-alapú chunkolás direkt túlegyszerűsített — arra volt jó, hogy a minta látszódjon. Fejleszd tovább tetszőlegesen, és írd le az indoklást: mi következik a tudásbázisod tagoltságából, mit nyersz a változtatással. A felesleges túlbonyolítás sem érdem — a jó stratégia a tudásbázishoz illik, nem a bevetett technikák számán múlik.

A chunkolás determinisztikus → tesztelhető. Legalább pár unit teszt legyen rajta.

## 3. A keresési pipeline

Kötelező elemek:

- embedding + vektor-tárolás — pgvector ajánlott, de ha mást választasz, indokold
- HyDE
- rerank
- grounding — a válaszok forráshivatkozással (dokumentum címe / URL / fájlnév), és ha nincs találat, az agent kimondja
- multi-provider routing

A pipeline-ban legalább két különböző provider modelljét használd. Írd le a szereposztást és az indoklást: melyik modell mit csinál, és miért pont az.

## 4. Golden set — bizonyítsd, hogy a pipeline csinál valamit

Állíts össze 5–10 kérdésből álló tesztkészletet a saját domainedből, és futtasd le mindet kétféleképpen:

1. nyers vektorkeresés (csak embedding + távolság)
2. teljes pipeline (HyDE + rerank)

A kettő összevetését dokumentáld (táblázat vagy a debug-kimenetek). Legalább egy kérdésnél mutasd be konkrétan, hogy a rerank átrendezte a sorrendet — és írd le, miért jobb az új sorrend. Ha egyetlen kérdésnél sem rendez át semmit, az is eredmény: akkor azt magyarázd meg, miért nem.

### Negatív teszt

A golden setben legyen legalább egy kérdés, amire a tudásbázisodban nincs válasz — és mutasd be, hogy az agent ezt ki is mondja, forráskitalálás helyett. Ez a grounding próbája: enélkül a prompt-szabály csak dísz.

## 5. Architektúra-spec: a tudásbázis karbantartása (csak terv, nem kód)

A tudásbázis nem statikus — a forrás holnap változik, a vektoraid a tegnapi igazságot mondják. Ezt NEM kell leimplementálni. Amit kérünk: egy külön dokumentum (`docs/ARCHITEKTURA.md`), ami leírja, hogyan oldanád meg az inkrementális frissítést a saját rendszeredben:

- honnan tudod, hogy egy dokumentum változott (és hogyan éred el, hogy ami nem változott, ne vektorizálódjon újra)?
- mi történik az új dokumentummal?
- mi történik a törölt dokumentum chunkjaival?
- mikor / mi triggereli az újraindexelést?

Kötelező melléklet: egy architektúra-ábra (Miro, draw.io vagy hasonló — screenshot / export a repóba). Az ábrán látszódjon a teljes adatfolyam: forrás → változásérzékelés → chunk → embed → tárolás, és a törlés/módosítás útja.

Nem a „tökéletes” megoldást keressük — hanem azt, hogy végiggondoltad az eseteket.

## 6. Költségbecslés

Egy rövid bekezdés a README-ben:

- mennyibe került a teljes tudásbázis vektorizálása (ingest)?
- mennyibe kerül egy kérdés a teljes pipeline-nal (HyDE-hívás + embedding + rerank + válasz)?

Elég a nagyságrend, de a saját számaidból — nem az órai példából.

## Leadandók (összefoglalva)

- működő repo: ingest + keresési pipeline + agent, futtatási instrukciókkal
- chunking-stratégia leírása indoklással
- golden set + nyers vs. teljes pipeline összevetés + a negatív teszt eredménye
- multi-provider szereposztás leírása
- `docs/ARCHITEKTURA.md` a tudásbázis-karbantartás tervével + ábra-screenshot
- költségbecslés

## Amit értékelünk

Nem a kód mennyiségét. Azt, hogy:

- a chunking-döntéseid a tudásbázisodból következnek, nem másolatok
- a golden set valóban megmutatja, mit ad hozzá a HyDE és a rerank
- a grounding működik — a negatív teszt átmegy
- az architektúra-spec végiggondolt — az eseteket lefedi, az ábra követhető
- a routing-döntéseid indokoltak

> **Egy tanács:** ha rossz a válasz, először a retrievalt nézd — a debug-végpontok mintájára építs magadnak láthatóságot. Aki vakon fejleszt RAG-ot, az a promptot fogja hibáztatni a rossz találatok helyett.

**Kapcsolódó alkalom:** 6. óra — „Honnan tudja az agent, amit tud?”

**Leadás:** repo link feltöltése az LMS-be.
