# Plantbase ügyféloldali use case terve

## 1. Use case

**Személyre szabott növénycsomag-ajánló emberi jóváhagyással**

Az ügyfél egy egyszerű webes űrlapon megadja egy szoba jellemzőit és az igényeit. A Plantbase agent ezek alapján lekérdezi a növénykatalógust, összeállít egy megfelelő növénycsomagot, majd azt kiküldés előtt egy lakberendező ellenőrzi és jóváhagyja.

A megoldás a korábbi Plantbase rendszerre épül:

```text
természetes nyelvű igény
        ↓
      agent
        ↓
    SELECT SQL
        ↓
products katalógus
        ↓
személyre szabott ajánlat
```

Az új elemek az ügyféloldali webes bejárat, az ügy státuszának követése és az emberi jóváhagyás.

## 2. Ügyfélfolyamat

1. Az ügyfél megnyitja a localhoston futó webalkalmazást.
2. Megadja a szoba típusát, fényviszonyait, a rendelkezésre álló helyet, a kívánt színeket vagy stílust, a költségkeretet és a különleges elvárásait.
3. A rendszer létrehoz egy egyedi ügyazonosítót.
4. Az agent értelmezi az igényeket és lekérdezi a `products` táblát.
5. Összeállít egy 3-5 növényből álló csomagjavaslatot.
6. Ellenőrzi a méreteket, az árat, a készletet és az akciókat.
7. Az ajánlat `jóváhagyásra vár` állapotba kerül.
8. A lakberendező az adminfelületen jóváhagyja, módosításra visszaküldi vagy elutasítja.
9. Jóváhagyás után az ügyfél számára elérhetővé válik az ajánlat.
10. Az ügyfél az ügyazonosítóval megtekintheti az ügy aktuális állapotát.

Lehetséges állapotok:

```text
Beérkezett
→ Feldolgozás alatt
→ Emberi ellenőrzésre vár
→ Jóváhagyva
→ Ajánlat elkészült
```

## 3. Emberi jóváhagyási pont

A kötelező emberi kapu közvetlenül az ajánlat ügyfélhez történő kiküldése előtt van.

A lakberendező az alábbiakat látja:

- az ügyfél eredeti igénye;
- az agent által generált SQL;
- a lekérdezés eredménye;
- a javasolt növénycsomag;
- a teljes ár;
- az agent indoklása;
- a bizonytalanságok és figyelmeztetések.

Az AI elkészítheti a tervezetet, de ellenőrzés nélkül nem tehet ígéretet az ügyfélnek.

## 4. Bizonytalanság és eszkaláció

A rendszer emberhez irányítja az ügyet, ha:

- fontos adat hiányzik;
- nincs a feltételeknek megfelelő növény;
- a költségkeret nem tartható;
- az ügyfél igényei ellentmondanak egymásnak;
- a kérdés nem válaszolható meg a katalógusból;
- az agent nem tud megbízható SQL-lekérdezést készíteni;
- az ügyfél rendelni, reklamálni vagy jogi jellegű ügyet intézni szeretne.

A demó két esetet mutat be:

1. Egy szabályos kérésből sikeresen elkészülő és jóváhagyott ajánlat.
2. Egy hiányos vagy ellentmondásos kérés, amely ténylegesen az emberi várólistára kerül.

## 5. Megoldott üzleti problémák

### Elsődlegesen megoldott fájdalmak

**3. Az új ügyfél elveszettnek érzi magát.**

Az ügyfél strukturált igényfelmérést és konkrét első ajánlatot kap.

**5. Személyre szabott kiszolgálás csak a legnagyobb ügyfeleknek jut.**

Minden ügyfél a saját szobájához, keretéhez és ízléséhez igazított ajánlatot kap.

### Részben kezelt fájdalmak

- **1.** Az igény munkaidőn kívül is beküldhető.
- **2.** Az ismétlődő katalógusi keresést és ajánlat-előkészítést az agent végzi.
- **4.** Az ügyfél láthatja, hol tart az ajánlata.

A business case-ben a 3. és 5. fájdalom szerepeljen biztos vállalásként. A többi csak kiegészítő előny.

## 6. Hatókörön kívül

A PoC:

- nem vesz fel és nem módosít rendelést;
- nem kezel fizetést;
- nem foglal készletet;
- nem ad szállítási státuszt;
- nem kezel reklamációt vagy visszatérítést;
- nem módosítja a termékadatbázist;
- nem garantálja, hogy a készlet a későbbi rendeléskor is elérhető;
- nem helyettesít növényegészségügyi vagy mérgezőségi szakvéleményt;
- nem teszi elérhetővé az ajánlatot emberi jóváhagyás nélkül.

## 7. PoC-felületek

### Ügyféloldali igényfelmérő

- űrlap a szoba és az igények megadásához;
- beküldési lehetőség;
- egyedi ügyazonosító megjelenítése.

### Ügyféloldali státuszoldal

- az ügy aktuális állapota;
- jóváhagyás után a növénycsomag;
- teljes ár és rövid indoklás.

### Lakberendezői ellenőrzőfelület

- várakozó ügyek listája;
- eredeti ügyfélkérés;
- az agent eredménye és indoklása;
- jóváhagyás, visszaküldés vagy elutasítás.

## 8. Adatok

A meglévő `products` katalógus továbbra is csak olvasható marad. A PoC-hoz ezen kívül egy egyszerű SQLite- vagy JSON-alapú ügytároló szükséges.

Javasolt `cases` adatszerkezet:

```text
case_id
created_at
customer_name
customer_email
room_description
preferences
budget
status
generated_recommendation
agent_confidence
escalation_reason
reviewer_decision
reviewed_at
```

Az ügyfél e-mail-címét nem kell elküldeni a modellnek. A modell csak az ajánlás elkészítéséhez szükséges szobajellemzőket és preferenciákat kapja meg.

## 9. Mérési terv alapjai

Javasolt metrikák:

- ajánlattervezet elkészítési ideje;
- jóváhagyásig eltelt idő;
- emberi módosítás nélkül jóváhagyott ajánlatok aránya;
- eszkalációs arány;
- hibás vagy sikertelen SQL-lekérdezések aránya;
- költségkereten belül maradó ajánlatok aránya;
- ügyfelenként megtakarított lakberendezői idő.

Legalább az SQL-hibaarányt és az ember által javított ajánlatok arányát szerepeltetni kell, mert ezek az agent hibáját is mérik.

## 10. Sikerkritérium

> Az ügyfél élethű igényéből a rendszer öt percen belül katalógusadatokra épülő ajánlattervezetet készít, amely csak emberi jóváhagyás után válik láthatóvá az ügyfél számára.

## 11. Technikai előfeltétel

A jelenlegi repóban csak a feladat dokumentumai találhatók, a korábbi Plantbase forráskód nem. A megvalósításhoz a korábbi alkalmazás kódját ebbe a repóba kell másolni, vagy annak szükséges működő részét itt újra létre kell hozni.
