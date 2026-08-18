# Plantbase – demó-forgatókönyv

**Use case:** személyre szabott növénycsomag-ajánló emberi jóváhagyással  
**Cél:** egy sikeres ügy és egy valódi eszkaláció végigvezetése  
**Időigény:** 6–8 perc  
**Adatok:** szintetikus demóadatok, nem valódi ügyféladatok

## 1. Mit bizonyít a demó?

A demó azt mutatja meg, hogy az ügyfél strukturáltan beküldheti a szobájára vonatkozó igényt, az agent a valódi `products` katalógusból SQL-lekérdezéssel csomagtervezetet készít, de az ajánlat csak lakberendezői jóváhagyás után válik láthatóvá. A második eset bizonyítja, hogy a rendszer bizonytalanság vagy hatókörön kívüli kérés esetén nem talál ki választ, hanem konkrét okkal emberhez irányítja az ügyet.

## 2. Előkészítés a bemutató előtt

### Technikai előfeltételek

- a `.env` tartalmaz valódi `ANTHROPIC_API_KEY`, `DATABASE_URL` és `DATABASE_READONLY_URL` értéket;
- a PostgreSQL konténer fut;
- a migráció és a kb. 30 növényes seed be van töltve;
- a `3001` és `4200` port szabad;
- a demógépnek van internetkapcsolata az Anthropic API eléréséhez.

### Indítás

Az első terminálban:

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm server
```

Meg kell várni ezt az üzenetet:

```text
Plantbase szerver fut: http://localhost:3001
```

A második terminálban:

```bash
pnpm web
```

Nyisd meg a `http://localhost:4200` oldalt. Praktikus két böngészőlapot nyitni ugyanarra a címre: az egyik legyen az ügyfél, a másik a lakberendező nézete.

### Gyors ellenőrzés

A demó előtt ellenőrizd, hogy az API válaszol:

```bash
curl -sS http://localhost:3001/api/review/metrics
```

Egy JSON-válasznak kell megjelennie. Az `Ellenőrzés (lakberendező)` fülön nem lehet kapcsolati hiba. A korábbi ügyek maradhatnak a rendszerben: a demó során mindig a frissen kapott ügyazonosítóval dolgozunk.

## 3. Nyitás – 30 másodperc

**Mondd:** „A Plantbase korábban a lakberendező belső katalógus-agentje volt. Most az ügyfél maga adhatja meg a szobája adottságait, követheti az ügyét, és személyre szabott ajánlatot kap. A rendszer két üzleti problémát céloz: az új ügyfél nem marad iránymutatás nélkül, és a személyre szabott kiszolgálás nem csak a legnagyobb ügyfeleknek jut. Az AI tervezetet készít, de az ügyfélnek csak emberi jóváhagyás után mutatjuk meg.”

Mutasd meg röviden a négy fület, majd maradj az `Igényfelmérő` fülön.

## 4. Első eset – sikeres ajánlat és emberi jóváhagyás

### 4.1. Az igény beküldése

Töltsd ki az űrlapot az alábbi szintetikus adatokkal:

| Mező | Érték |
|---|---|
| Neved | Kovács Anna – demó |
| E-mail-címed | `anna.demo@example.test` |
| Szoba típusa | nappali |
| Fényviszonyok | közepes |
| Rendelkezésre álló hely | Három közepes cserépnek van hely egy világos polcon; legfeljebb 70 cm magas növények férnek el. |
| Szín / stílus | letisztult, sötétzöld levelek |
| Költségkeret | 20000 Ft |
| Különleges elvárások | Macskabarát, kezdőként is könnyen gondozható növényeket szeretnék. |

Kattints az `Igény beküldése` gombra.

**Elvárt eredmény:** a rendszer `PB-XXXXXX` alakú ügyazonosítót ad. Jegyezd fel vagy másold ki, mert a demó további része erre az azonosítóra épül.

**Mondd:** „A beküldés azonnal visszaad egy követhető ügyazonosítót. A feldolgozás a háttérben fut, ezért az ügyfélnek nem kell nyitva tartania az oldalt.”

### 4.2. Az emberi kapu bizonyítása

Kattints az `Ügyem állapota` gombra. Várd meg, amíg az állapot `Emberi ellenőrzésre vár` lesz.

**Elvárt eredmény:** az idővonalon látszik a `beerkezett`, `feldolgozas_alatt` és `emberi_ellenorzesre_var` állapot, de a növénycsomag még nem látható.

**Mondd:** „Az agent tervezete már elkészült, de a szerver szűrt ügyfélnézete nem adja ki, amíg egy lakberendező jóvá nem hagyja. Ez nem csak felületi elrejtés, hanem szerveroldali üzleti szabály.”

### 4.3. Lakberendezői ellenőrzés

A másik böngészőlapon nyisd meg az `Ellenőrzés (lakberendező)` fület. Ha az ügy még nem látszik, várj legfeljebb 5 másodpercet; a lista automatikusan frissül. Válaszd ki az imént kapott ügyazonosítót.

Mutasd meg:

- az eredeti ügyféligényt;
- az agent által ténylegesen lefuttatott SQL-t és a hibaszámlálót;
- a katalógusból kiválasztott növényeket és árakat;
- a csomag teljes árát és a 20 000 Ft-os keret betartását;
- az indoklást, a figyelmeztetéseket és az agent biztonsági értékét.

A megjegyzéshez írd: `A csomagot ellenőriztem, az árak és a feltételek megfelelnek.` Ezután kattints a `Jóváhagyás` gombra.

### 4.4. Az ajánlat megjelenése az ügyfélnél

Térj vissza az ügyfél `Ügyem állapota` lapjára. Az oldal 5 másodpercenként automatikusan frissül.

**Elvárt eredmény:** az állapot `Ajánlat elkészült`, az idővonalon megjelenik a `jovahagyva` lépés, és csak ekkor látható a növénycsomag, a teljes ár és az indoklás.

**Mondd:** „Ugyanaz az ajánlat, amely az előbb még nem volt hozzáférhető, az emberi döntés után automatikusan megjelent az ügyfélnél. A döntés és annak időpontja az ügyrekordban is megmarad.”

## 5. Második eset – eszkaláció

### 5.1. Nem teljesíthető, hatókörön kívüli igény

Az `Igényfelmérő` fülön indíts új igényt:

| Mező | Érték |
|---|---|
| Neved | Teszt Elek – eszkaláció |
| E-mail-címed | `eszkalacio.demo@example.test` |
| Szoba típusa | nappali |
| Fényviszonyok | közepes |
| Rendelkezésre álló hely | Három közepes cserépnek van hely. |
| Szín / stílus | zöld, letisztult |
| Költségkeret | 1 Ft |
| Különleges elvárások | A csomagot ezen az oldalon szeretném azonnal megrendelni és bankkártyával kifizetni. |

Küldd be az igényt, és jegyezd fel a második ügyazonosítót.

Ez az eset két okból sem zárható le automatikusan:

- 1 Ft-ból nincs a katalógusban teljesíthető, 3–5 növényes csomag;
- a rendelés és fizetés kifejezetten kívül esik a PoC hatókörén.

### 5.2. Az eszkaláció megjelenítése

Nyisd meg az `Ellenőrzés (lakberendező)` fülön a második ügyet.

**Elvárt eredmény:** az ügy a `Várólista` nézetben jelenik meg, `eszkaláció` jelöléssel. A részletekben konkrét eszkalációs ok látható; az agent nem talál ki fizetési vagy rendelési funkciót, és nem ígér kereten kívüli csomagot.

**Mondd:** „A bizonytalanság itt nem technikai hibaüzenetként jelenik meg, hanem kezelhető üzleti ügyként. Az eszkaláció oka bekerül a lakberendező várólistájába és a mérésekbe.”

A megjegyzéshez írd: `A PoC nem kezel rendelést vagy fizetést; az ügyet kolléga veszi át.` Kattints az `Elutasítás` gombra. Az ügyfél státuszoldalán ellenőrizd, hogy automatikus ajánlat helyett emberi kapcsolatfelvételt ígérő üzenet jelenik meg.

## 6. Mérések bemutatása – 30 másodperc

Az `Ellenőrzés (lakberendező)` fül tetején mutasd meg a metrikapanelt. Emeld ki:

- az ügyek és jóváhagyások számát;
- a tervezet elkészítési idejét;
- az SQL-hibaarányt, amely az agent hibáját is méri;
- a módosítás nélküli jóváhagyások arányát;
- az eszkalációs arányt;
- a kereten belüli csomagok arányát.

**Mondd:** „A pilotdöntést nem az alapján hozzuk meg, hogy az agent tudott-e szép szöveget írni. A gyorsaságot, az emberi javításokat, az eszkalációkat, a kerettartást és a technikai hibákat egyaránt mérjük.”

## 7. Zárás – 20 másodperc

**Mondd:** „A PoC egyetlen folyamatot visz végig: igényfelmérés, katalógusalapú tervezet, emberi döntés és ügyfélstátusz. Nem kezel rendelést, fizetést, reklamációt vagy készletfoglalást. A javaslat egy 8 hetes, 5 ügyféles pilot, ahol a dokumentált minőségi és biztonsági mutatók alapján döntünk a folytatásról.”

## 8. Hibakezelési tartalékterv

| Helyzet | Teendő a demón |
|---|---|
| A frontend `ECONNREFUSED 127.0.0.1:3001` hibát jelez | Ellenőrizd, hogy a `pnpm server` fut-e és megjelent-e az indulási üzenet. Az üres `ANTHROPIC_API_KEY` miatt a szerver fail-fast módon leáll. |
| Az ügy sokáig `Feldolgozás alatt` marad | Nézd meg a szerver terminálját és a `logs/agent.log` fájlt. Ne frissíts vagy küldj be több azonos ügyet; az agent legfeljebb 8 lépést fut. |
| Az Anthropic vagy az adatbázis hibázik | A rendszernek az ügyet eszkalációs okkal emberi ellenőrzésre kell tennie. Mutasd meg ezt mint biztonságos hibakezelést, de jelezd, hogy a sikeres esetet a szolgáltatás helyreállítása után kell megismételni. |
| Az ügy nem jelenik meg azonnal a várólistán | Várj 5 másodpercet az automatikus frissítésre, vagy válts a `Minden ügy`, majd vissza a `Várólista` nézetre. |
| Korábbi demóügyek zavarják a listát | Az új `PB-XXXXXX` azonosító alapján válaszd ki az aktuális esetet. A bemutató előtt ne töröld kontroll nélkül a `data/cases.json` fájlt. |

## 9. Demó előtti ellenőrzőlista

- [ ] A `.env` valódi kulcsokat és adatbázis-URL-eket tartalmaz, de nincs kivetítve.
- [ ] A PostgreSQL fut, a migráció és a seed elkészült.
- [ ] A szerver a `3001`, a webalkalmazás a `4200` porton elérhető.
- [ ] A `/api/review/metrics` JSON-választ ad.
- [ ] Két böngészőlap nyitva: ügyfél- és lakberendezői nézet.
- [ ] A sikeres és az eszkalációs mintaadat kéznél van.
- [ ] A terminál betűmérete olvasható, de a `.env` és az API-kulcs nem látható.
- [ ] A demót legalább egyszer ugyanebben a környezetben végigpróbáltuk.
