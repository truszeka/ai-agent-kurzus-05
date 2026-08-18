# Plantbase – kérdéslap a vezetői bemutatóhoz

**Use case:** személyre szabott növénycsomag-ajánló emberi jóváhagyással  
**Rendszer:** Plantbase PoC  
**Dátum:** 2026.08.18.

## 1. Milyen személyes adat kerül a rendszerbe, és melyik pontján tűnik el vagy anonimizálódik?

Az igényfelmérő az ügyfél nevét és e-mail-címét is bekéri, mert ezek az ügy azonosításához és a későbbi kapcsolattartáshoz szükségesek; ezek az adatok a teljes ügyrekordban, a helyi `data/cases.json` fájlban maradnak. A modell meghívása előtt a `toModelIntake()` egy szűkített nézetet készít, amelyből a név és az e-mail-cím kimarad, ezért az Anthropic modell csak a szobatípust, a fényviszonyokat, a rendelkezésre álló helyet, a stíluspreferenciát, a költségkeretet és a különleges kéréseket kapja meg. A PoC jelenleg nem anonimizálja és nem törli automatikusan a helyben tárolt személyes adatokat; a pilot előtt megőrzési időt, törlési folyamatot és adatkezelési tájékoztatót kell meghatározni.

## 2. Hol fut a modell, hova utazik az adat, és mi az, ami sosem hagyja el a saját környezetünket?

A webalkalmazás és az Express API a PoC-ban helyben, localhoston fut, a `products` katalógus pedig a saját PostgreSQL-adatbázisban marad. A nyelvi modell az Anthropic szolgáltatásában fut, ezért a `toModelIntake()` által előállított, személyes azonosítóktól megtisztított szobaleírás és preferencialista, valamint a modellnek visszaadott katalóguseredmény elhagyja a saját környezetet. Az ügyfél neve és e-mail-címe, a teljes `data/cases.json`, az adatbázis hitelesítő adatai és a helyi naplófájlok nem kerülnek a modellhez. A PoC nem rögzít szolgáltatói régiót vagy adatrezidencia-garanciát, ezért éles pilot előtt az Anthropic szerződéses adatkezelési és régiós feltételeit külön jóvá kell hagyatni.

## 3. Melyik lépésnél hagy jóvá ember, mit lát a döntés előtt, és mit tud visszavonni utána?

Minden elkészült tervezet az `emberi_ellenorzesre_var` állapotban megáll, és a `decideCase()` csak lakberendezői `approve`, `revise` vagy `reject` döntéssel engedi tovább. A lakberendező a döntés előtt látja az eredeti igényt, a generált SQL-lekérdezéseket, a javasolt növényeket, az összárat, az indoklást, a figyelmeztetéseket, a biztonsági értéket és az eszkaláció okát; módosíthatja a tervezetet, visszaküldheti újrafuttatásra vagy elutasíthatja. Az ügyfél a `toCustomerView()` szűrése miatt csak az `ajanlat_elkeszult` állapotban láthat ajánlatot. A PoC-ban a már publikált ajánlat visszavonására nincs külön felületi művelet; ezt élesítés előtt státusz-visszavonással és ügyfél-értesítéssel kell kiegészíteni.

## 4. Mi kerül naplóba, ki fér hozzá, és mennyi ideig marad meg?

Az ügy teljes állapota a `data/cases.json` fájlba kerül: az ügyfél által megadott adatok, az állapottörténet, az agent ajánlata, a generált SQL-ek, az SQL-kísérletek és hibák száma, az eszkaláció oka, valamint az emberi döntés és annak időpontja. Az agent futásáról ezen felül a `logs/<timestamp>.json` és a `logs/agent.log` tartalmaz technikai nyomot, például promptot, modellüzeneteket, toolhívást, SQL-t, eredményt, tokenhasználatot és költséget. Helyi futásban ezekhez az fér hozzá, akinek fájlrendszer-hozzáférése van; a lakberendezői API csak az ügyhöz szükséges rekordot mutatja. Automatikus törlés és rögzített megőrzési idő jelenleg nincs, ezért a pilot előtt jogosultsági szabályt, naplóminimalizálást és dokumentált megőrzési-törlési időt kell bevezetni.

## 5. Mi történik, ha az agent téved, és mennyi idő alatt állítható vissza az előző állapot?

Az agent hibája nem jut automatikusan az ügyfélhez: minden tervezet emberi ellenőrzésre kerül, az üres találat, a kerettúllépés és a `0,5` alatti biztonsági érték pedig eszkalációs okot és figyelmeztetést hoz létre. A lakberendező kijavíthatja, visszaküldheti vagy elutasíthatja a tervezetet; a `products` katalógust az ajánló folyamat read-only kapcsolaton éri el, ezért egy hibás ajánlás nem módosít termékadatot. Ha rendszerszintű hiba jelentkezik, a webes bejárat percek alatt leállítható, és a lakberendező visszatérhet a korábbi kézi folyamathoz. A PoC nem tartalmaz automatikus verziózott visszaállítást a `cases.json` fájlhoz, ezért az adatállapot garantált helyreállításához mentés vagy tranzakciós adattár kell a pilot előtt.

## 6. Ki lesz a rendszer gazdája a bevezetés után, és miből fogja látni, hogy jól működik?

Az üzleti folyamat gazdája a vezető lakberendező, a technikai üzemeltetés gazdája pedig az e-commerce csapat; a vezető lakberendező felel az ajánlatminőségért, az eszkalációs szabályokért és a pilot visszajelzéseiért, az e-commerce csapat pedig az elérhetőségért, konfigurációért és naplózásért. A `/api/review/metrics` és az ellenőrzőfelület megmutatja az ügyek számát, az ajánlattervezet elkészítési és jóváhagyási idejét, a módosítás nélkül elfogadott ajánlatok, az eszkalációk, az SQL-hibák és a kereten belüli csomagok arányát, valamint a becsült megtakarított munkaidőt. A pilot folytatásáról ezek és a lakberendezői minőségi ellenőrzés alapján kell dönteni, nem pusztán a generált ajánlatok száma alapján.

## 7. Saját kérdés: Mi akadályozza meg, hogy egy illetéktelen személy megnyissa a lakberendezői felületet, elolvassa az ügyféladatokat vagy jóváhagyjon egy ajánlatot?

A jelenlegi PoC-ban semmi: a `/api/review/*` végpontok és a lakberendezői felület nincsenek hitelesítéssel és szerepkör-alapú jogosultságkezeléssel védve. Ez localhostos demonstrációnál elfogadott, de hálózaton vagy valódi ügyféladattal nem vállalható kockázat. A pilot előtt kötelező a vállalati beléptetés integrálása, a `reviewer` szerepkör ellenőrzése minden review végponton, a döntéshozó azonosítójának auditnaplózása és a személyes adatokhoz való hozzáférés korlátozása; ezek nélkül a rendszer nem léphet túl a PoC-fázison.

## 8. Saját kérdés: Mi történik, ha a `data/cases.json` megsérül, elveszik, vagy egyszerre több szerverpéldány próbálja módosítani?

A JSON-tároló egyetlen folyamaton belül sorba állítja az írásokat, ezért a helyi demó párhuzamos kérései nem írják felül egymást, de ez nem nyújt védelmet fájlsérülés, lemezhiba vagy több szerverpéldány esetén. A jelenlegi olvasó a hibás JSON-t üres tárolóként kezeli, ami demóban megakadályozza az összeomlást, de elrejtheti az adatvesztést; automatikus mentés és helyreállítás nincs. A pilot előtt az ügyeket tranzakciós adatbázisba kell költöztetni, rendszeres mentéssel, integritás-ellenőrzéssel és riasztással; addig a PoC csak egyetlen helyi példányon, szintetikus mintaadattal használható.
