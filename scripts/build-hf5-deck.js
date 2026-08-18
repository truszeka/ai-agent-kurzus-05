// Futtatás:  npm i pptxgenjs  &&  node build-hf5-deck.js docs/hf5-business-case.pptx
const pptxgen = require('pptxgenjs');

// Plantbase HF5 — döntéselőkészítő prezentáció.
// Paletta: erdőzöld + krém (növény-domain, meleg, nem steril tech), terrakotta akcentus
// az emberi kapunak és az eszkalációnak. Lapos design, gradiens nélkül.
const FOREST = '40695B', DEEP = '2C4A40', CREAM = 'FFE1C7', PAPER = 'FCFCFC';
const INK = '2C2C2C', MUTED = '6B7C76', TERRA = 'C1583C', LINE = 'D8DEDA';
const F = 'Arial';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Truszek Attila';
pptx.title = 'Plantbase — ügyféloldali növénycsomag-ajánló';

const W = 10, H = 5.625, M = 0.5;

function slide(title, kicker) {
  const s = pptx.addSlide();
  s.background = { color: PAPER };
  if (title) {
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.9, fill: { color: FOREST } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: W, h: 0.045, fill: { color: TERRA } });
    s.addText(title, { x: M, y: 0.14, w: 7.2, h: 0.58, fontFace: F, fontSize: 19, bold: true, color: 'FFFFFF', valign: 'middle' });
    if (kicker) {
      s.addText(kicker, { x: 7.75, y: 0.24, w: W - 7.75 - M, h: 0.4, fontFace: F, fontSize: 10.5, color: CREAM, align: 'right' });
    }
  }
  return s;
}

function footer(s, page) {
  s.addText('Plantbase · ügyféloldali PoC · 2026.08.18', {
    x: M, y: H - 0.42, w: 5, h: 0.3, fontFace: F, fontSize: 8.5, color: MUTED });
  s.addText(String(page), { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontFace: F, fontSize: 8.5, color: MUTED, align: 'right' });
}

function card(s, { x, y, w, h, fill = 'FFFFFF', border = LINE, accent }) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: { color: border, width: 1 } });
  if (accent) s.addShape(pptx.ShapeType.rect, { x, y, w: 0.06, h, fill: { color: accent } });
}

function head(cells) {
  return cells.map((t) => ({
    text: t,
    options: { fill: { color: DEEP }, color: 'FFFFFF', bold: true, fontSize: 10, fontFace: F, valign: 'middle' },
  }));
}

const TABLE = { border: { pt: 0.5, color: LINE }, fontFace: F, fontSize: 9.5, color: INK, valign: 'middle', autoPage: false };

/* ---------------------------------------------------------------- 1. Címlap */
{
  const s = pptx.addSlide();
  s.background = { color: FOREST };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: TERRA } });
  s.addText('PLANTBASE', { x: 0.9, y: 1.15, w: 8.5, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: CREAM, charSpacing: 4 });
  s.addText('Személyre szabott növénycsomag-ajánló\nemberi jóváhagyással', {
    x: 0.9, y: 1.55, w: 8.6, h: 1.5, fontFace: F, fontSize: 26, bold: true, color: 'FFFFFF', lineSpacingMultiple: 1.15 });
  s.addText('Az ügyfél megadja a szobája adottságait és a keretét; az agent a katalógusból csomagtervezetet készít; a tervezet CSAK lakberendezői jóváhagyás után jut el az ügyfélhez.', {
    x: 0.9, y: 3.15, w: 8.3, h: 0.8, fontFace: F, fontSize: 13, color: CREAM, lineSpacingMultiple: 1.25 });
  s.addText('Döntéselőkészítő anyag a vezetői körnek  ·  Szponzor: e-commerce igazgató  ·  Folyamatgazda: vezető lakberendező  ·  2026.08.18', {
    x: 0.9, y: 4.55, w: 8.5, h: 0.4, fontFace: F, fontSize: 10, color: 'D8E3DE' });
}

/* ------------------------------------------------- 2. Mit old meg / mit nem */
{
  const s = slide('Milyen fájdalmat old meg — és melyiket nem', 'a tíz fájdalomból');
  card(s, { x: M, y: 1.2, w: 4.5, h: 3.7, accent: FOREST });
  s.addText('BIZTOS VÁLLALÁS', { x: 0.72, y: 1.34, w: 4.1, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: FOREST, charSpacing: 1.5 });
  s.addText([
    { text: '3. Az új ügyfél elveszettnek érzi magát\n', options: { bold: true, fontSize: 12 } },
    { text: 'Strukturált igényfelmérő és konkrét első ajánlat, munkaidőn kívül is beküldhető.\n\n', options: { fontSize: 10.5, color: MUTED } },
    { text: '5. Személyre szabás csak a nagyoknak jut\n', options: { bold: true, fontSize: 12 } },
    { text: 'Minden ügyfél a saját szobájához, keretéhez és ízléséhez igazított csomagot kap.', options: { fontSize: 10.5, color: MUTED } },
  ], { x: 0.72, y: 1.7, w: 4.1, h: 2.0, fontFace: F, color: INK, lineSpacingMultiple: 1.15 });
  s.addText([
    { text: 'Részben: ', options: { bold: true } },
    { text: '1. (munkaidőn kívüli beküldés) · 2. (ismétlődő katalógus-keresés) · 4. (az ügyfél látja, hol tart)' },
  ], { x: 0.72, y: 3.95, w: 4.1, h: 0.8, fontFace: F, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.15 });

  card(s, { x: 5.2, y: 1.2, w: 4.3, h: 3.7, accent: TERRA });
  s.addText('AMIT NEM OLD MEG', { x: 5.42, y: 1.34, w: 3.9, h: 0.3, fontFace: F, fontSize: 10, bold: true, color: TERRA, charSpacing: 1.5 });
  s.addText([
    { text: 'A tíz fájdalomból: 6. (tanulás a panaszokból), 7. (szerződéskötés), 8. (sürgősség szerinti sorolás), 9. (egységes válasz minden csatornán), 10. (churn-előrejelzés).\n\n', options: {} },
    { text: 'A PoC hatókörén kívül: ', options: { bold: true } },
    { text: 'nem vesz fel rendelést, nem kezel fizetést, nem foglal készletet, nem ad szállítási státuszt, nem kezel reklamációt, nem módosítja a termékadatbázist, és nem ad növényegészségügyi szakvéleményt.', options: {} },
  ], { x: 5.42, y: 1.7, w: 3.9, h: 3.0, fontFace: F, fontSize: 10.5, color: INK, lineSpacingMultiple: 1.2 });
  footer(s, 2);
}

/* ------------------------------------------------ 3. A folyamat + eszkaláció */
{
  const s = slide('Mit csinál a rendszer — és hol áll meg', 'a PoC folyamata');
  const steps = [
    ['1 · IGÉNYFELMÉRŐ', 'szoba, fény, hely,\nstílus, keret'],
    ['2 · ÜGY NYÍLIK', 'egyedi azonosító\n(PB-7QK3ZA)'],
    ['3 · AGENT', 'SQL a katalógusra,\nread-only'],
    ['4 · TERVEZET', 'csomag, összár,\nindoklás, warningok'],
  ];
  const bw = 2.15, gap = 0.24;
  steps.forEach(([t, d], i) => {
    const x = M + i * (bw + gap);
    card(s, { x, y: 1.25, w: bw, h: 1.15, fill: 'FFFFFF', accent: FOREST });
    s.addText(t, { x: x + 0.14, y: 1.34, w: bw - 0.24, h: 0.28, fontFace: F, fontSize: 9.5, bold: true, color: FOREST });
    s.addText(d, { x: x + 0.14, y: 1.62, w: bw - 0.24, h: 0.7, fontFace: F, fontSize: 10, color: INK, lineSpacingMultiple: 1.1 });
    if (i < 3) s.addShape(pptx.ShapeType.rightArrow, { x: x + bw + 0.02, y: 1.72, w: 0.2, h: 0.2, fill: { color: MUTED } });
  });

  card(s, { x: M, y: 2.65, w: 4.44, h: 1.35, fill: 'FFF3E8', accent: TERRA });
  s.addText('5 · EMBERI KAPU  (kötelező)', { x: 0.68, y: 2.76, w: 4.1, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: TERRA });
  s.addText('A lakberendező látja az eredeti kérést, a generált SQL-t, a csomagot, az összárat, az indoklást és a figyelmeztetéseket. Jóváhagy, visszaküld módosításra vagy elutasít.', {
    x: 0.68, y: 3.06, w: 4.1, h: 0.85, fontFace: F, fontSize: 10, color: INK, lineSpacingMultiple: 1.15 });

  card(s, { x: 5.18, y: 2.65, w: 4.32, h: 1.35, fill: 'FFFFFF', accent: FOREST });
  s.addText('6 · AZ ÜGYFÉL LÁTJA', { x: 5.4, y: 2.76, w: 4, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: FOREST });
  s.addText('Az ajánlat kizárólag jóváhagyás után jelenik meg a státuszoldalon. Jóváhagyás nélkül a végpont nem is küldi ki — ezt automata tesztek őrzik.', {
    x: 5.4, y: 3.06, w: 4, h: 0.85, fontFace: F, fontSize: 10, color: INK, lineSpacingMultiple: 1.15 });

  card(s, { x: M, y: 4.15, w: 9, h: 0.85, fill: 'FFFFFF', accent: TERRA });
  s.addText([
    { text: 'Ha a rendszer bizonytalan → nem talál ki ajánlatot, hanem embert hív. ', options: { bold: true } },
    { text: 'Hiányzó adat · nincs megfelelő növény · a keret nem tartható · ellentmondó igény · megbízhatatlan SQL · rendelés, reklamáció vagy jogi ügy → eszkalációs okkal a lakberendező elé.', options: { color: MUTED } },
  ], { x: 0.68, y: 4.26, w: 8.7, h: 0.65, fontFace: F, fontSize: 10, color: INK, lineSpacingMultiple: 1.15 });
  footer(s, 3);
}

/* -------------------------------------------------------------- 4. Adattérkép */
{
  const s = slide('Adattérkép — egy ügyfélkérés útja', 'kötelező dia');
  const rows = [
    head(['ADAT', 'HOL KELETKEZIK', 'HOVA MEGY', 'MEDDIG ŐRIZZÜK']),
    ['Név, e-mail', 'ügyfél böngészője', 'saját szerver → data/cases.json (helyben marad)\nA MODELLHEZ SOHA NEM MEGY', 'ügy lezárásáig, majd törlendő'],
    ['Szoba, fény, hely,\nstílus, keret, elvárás', 'ügyfél böngészője', 'saját szerver → Anthropic API (api.anthropic.com, USA-beli feldolgozás)\n+ helyi ügytár', 'ügytárban: ügy lezárásáig'],
    ['Generált SQL és a\nkatalógus-találatok', 'a modell / Postgres', 'Postgres read-only (helyi) → vissza a modellhez\n(nyilvános termékadat)', 'ügytár + trace-napló'],
    ['Ajánlat, indoklás,\nbizonytalanság', 'a modell', 'helyi ügytár → jóváhagyás után az ügyfél', 'ügy lezárásáig'],
    ['Trace-napló\n(prompt, SQL, tokenszám)', 'saját szerver', 'logs/*.json és logs/agent.log — nem hagyja el a gépet', 'fejlesztői napló, rotálandó'],
  ];
  s.addTable(rows, { ...TABLE, x: M, y: 1.15, w: 9, colW: [1.75, 1.5, 3.9, 1.85], rowH: [0.34, 0.6, 0.66, 0.66, 0.5, 0.66] });
  s.addText([
    { text: 'Amit soha nem küldünk ki: ', options: { bold: true, color: TERRA } },
    { text: 'ügyfélnév, e-mail-cím, adatbázis-hitelesítő adat, teljes katalógus-export.   ·   ', options: {} },
    { text: 'Beépítendő: ', options: { bold: true } },
    { text: 'a trace ma nem köti a tokenköltséget az ügyazonosítóhoz — ehhez a caseId-t a naplóba kell írni.', options: {} },
  ], { x: M, y: 4.66, w: 9, h: 0.44, fontFace: F, fontSize: 9.5, color: INK, lineSpacingMultiple: 1.15 });
  footer(s, 4);
}

/* ------------------------------------------------------------- 5. Mérési terv */
{
  const s = slide('Mérési terv — honnan tudjuk, hogy működik', 'kötelező dia');
  const rows = [
    head(['MIT MÉRÜNK', 'HONNAN LESZ ADAT', 'HOGYAN RIPORTÁLJUK', 'KINEK']),
    [{ text: 'Ajánlattervezet elkészítési ideje', options: { bold: true } }, 'ügytár: createdAt → draftReadyAt\n(ma is naplózza)', 'heti automatikus összesítő', 'folyamatgazda'],
    ['Jóváhagyásig eltelt idő', 'ügytár: createdAt → reviewedAt', 'heti összesítő', 'folyamatgazda'],
    [{ text: 'Emberi módosítás nélkül jóváhagyott arány', options: { bold: true } }, 'ügytár: reviewerModified jelző', 'havi egy dia a vezetői riportban', 'szponzor'],
    ['Eszkalációs arány', 'ügytár: escalationReason kitöltve', 'havi egy dia', 'szponzor'],
    [{ text: 'Hibás SQL-lekérdezések aránya', options: { bold: true, color: TERRA } }, 'agent tool-napló: sqlErrorCount / sqlAttemptCount', 'heti összesítő + riasztás 10% felett', 'fejlesztés'],
    ['Költségkereten belüli ajánlatok aránya', 'ügytár: összár vs. megadott keret', 'havi egy dia', 'szponzor'],
  ];
  s.addTable(rows, { ...TABLE, x: M, y: 1.15, w: 9, colW: [2.6, 3.1, 2.35, 0.95], rowH: [0.34, 0.52, 0.42, 0.52, 0.42, 0.52, 0.42] });
  s.addText([
    { text: 'Mind a hat metrika ma is naplózódik ', options: { bold: true } },
    { text: '— a GET /api/review/metrics végpont adja őket, nem kell hozzá új fejlesztés. Vastagon: a use case ígéretét, illetve az agent hibáját mérő metrikák. A részletes tábla a repóban.', options: {} },
  ], { x: M, y: 4.55, w: 9, h: 0.6, fontFace: F, fontSize: 9.5, color: INK, lineSpacingMultiple: 1.15 });
  footer(s, 5);
}

/* ------------------------------------------------------------ 6. Rollout terv */
{
  const s = slide('Rollout terv — pilot, döntési pont, gazda', 'kötelező dia');
  const cards = [
    ['PILOT', '2026.09.01 – 10.27', '5 ügyfél, kb. 15 szoba/hó, egy lakberendező heti 2 órája. Az első két hét kötelező baseline-mérés.', FOREST],
    ['DÖNTÉSI PONT', '2026.09.28 (4. hét)', 'Feltétel: a jóváhagyáshoz szükséges idő ≤ 5 perc/szoba ÉS az emberi javítási arány ≤ 30% ÉS nincs jóváhagyás nélkül kiment ajánlat.', TERRA],
    ['TELJES BEVEZETÉS', '2026.11.15-től', 'Minden beérkező ügyfélkérés a webes bejáraton. Az emberi kapu bevezetés után is marad.', FOREST],
  ];
  cards.forEach(([t, d, body, acc], i) => {
    const x = M + i * 3.1;
    card(s, { x, y: 1.2, w: 2.85, h: 2.35, accent: acc });
    s.addText(t, { x: x + 0.2, y: 1.32, w: 2.5, h: 0.28, fontFace: F, fontSize: 11, bold: true, color: acc, charSpacing: 1 });
    s.addText(d, { x: x + 0.2, y: 1.62, w: 2.5, h: 0.28, fontFace: F, fontSize: 10.5, bold: true, color: INK });
    s.addText(body, { x: x + 0.2, y: 1.95, w: 2.5, h: 1.45, fontFace: F, fontSize: 10, color: MUTED, lineSpacingMultiple: 1.15 });
  });
  card(s, { x: M, y: 3.75, w: 9, h: 1.15, fill: 'F2F6F4', accent: DEEP });
  s.addText('A RENDSZER GAZDÁJA A GO-LIVE UTÁN', { x: 0.7, y: 3.86, w: 8.6, h: 0.28, fontFace: F, fontSize: 10, bold: true, color: DEEP, charSpacing: 1 });
  s.addText([
    { text: 'Üzleti gazda: ', options: { bold: true } },
    { text: 'e-commerce csapat (folyamatgazda: vezető lakberendező) — ő nézi a heti összesítőt és dönt a promptok/szabályok finomhangolásáról.   ' },
    { text: 'Technikai gazda: ', options: { bold: true } },
    { text: 'fejlesztés — SQL-hibaarány, modellköltség, rendelkezésre állás. Havi közös átnézés.' },
  ], { x: 0.7, y: 4.14, w: 8.6, h: 0.65, fontFace: F, fontSize: 10, color: INK, lineSpacingMultiple: 1.15 });
  footer(s, 6);
}

/* ------------------------------------------------------- 7. Költség és haszon */
{
  const s = slide('Mennyibe kerül, mit hoz', 'forrásmegjelöléssel');
  card(s, { x: M, y: 1.15, w: 4.05, h: 2.3, fill: 'F2F6F4', accent: FOREST });
  s.addText('1,1 M Ft / év', { x: 0.7, y: 1.32, w: 3.7, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: FOREST });
  s.addText('kapacitás-megtakarítás  ·  BECSÜLT', { x: 0.7, y: 1.94, w: 3.7, h: 0.25, fontFace: F, fontSize: 10, bold: true, color: TERRA, charSpacing: 1 });
  s.addText('15 szoba/hó × 7,5 megtakarított perc × 8 000 Ft/óra × 12 hó.\nA baseline a BRS 10–15 perces becslésének középértéke: 12,5 perc → legfeljebb 5 perc szobánként.\nMegtérülés a lenti költségekkel: kb. 20 hónap.', {
    x: 0.7, y: 2.22, w: 3.7, h: 1.1, fontFace: F, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.15 });

  const rows = [
    head(['TÉTEL', 'EGYSZERI', 'ÉVES']),
    ['Fejlesztés (PoC, workflow, naplózás)', '900 e Ft', '—'],
    ['Integráció, adat, jogosultság', '250 e Ft', '—'],
    ['Betanítás, párhuzamos üzem (8 hét)', '150 e Ft', '—'],
    ['Licenc és modellhasználat', '—', '180 e Ft'],
    ['Üzemeltetés és támogatás', '—', '240 e Ft'],
    [{ text: 'ÖSSZESEN (felső becslés)', options: { bold: true } }, { text: '1 300 e Ft', options: { bold: true } }, { text: '420 e Ft', options: { bold: true } }],
  ];
  s.addTable(rows, { ...TABLE, x: 4.75, y: 1.15, w: 4.75, colW: [3.0, 0.95, 0.8], rowH: [0.3, 0.33, 0.33, 0.33, 0.33, 0.33, 0.35] });

  card(s, { x: M, y: 3.6, w: 4.4, h: 1.45, accent: TERRA });
  s.addText('AMIT A PoC MA MÁR IGAZOL  ·  MÉRT', { x: 0.7, y: 3.7, w: 4.0, h: 0.26, fontFace: F, fontSize: 9.5, bold: true, color: TERRA, charSpacing: 1 });
  s.addText([
    { text: 'A folyamat végigmegy: űrlap → tervezet → emberi döntés → ügyfélnézet (78 teszt zöld).\n' },
    { text: 'Jóváhagyás nélkül nem megy ki ajánlat.\n' },
    { text: 'Név és e-mail nem jut el a modellhez.' },
  ], { x: 0.7, y: 3.98, w: 4.0, h: 1.0, fontFace: F, fontSize: 9.5, color: INK, bullet: { code: '2022' }, lineSpacingMultiple: 1.15 });

  card(s, { x: 5.1, y: 3.6, w: 4.4, h: 1.45, fill: 'F2F6F4', accent: DEEP });
  s.addText('AMI MÉG BECSLÉS  ·  A PILOTON MÉRENDŐ', { x: 5.3, y: 3.7, w: 4.0, h: 0.26, fontFace: F, fontSize: 9.5, bold: true, color: DEEP, charSpacing: 1 });
  s.addText([
    { text: 'A 12,5 perces baseline és a 15 szoba/hó: BRS-becslés.\n' },
    { text: 'Az emberi javítási arányra ma nincs adatunk.\n' },
    { text: 'A modellköltség ökölszám, adopcióval nő.' },
  ], { x: 5.3, y: 3.98, w: 4.0, h: 1.0, fontFace: F, fontSize: 9.5, color: INK, bullet: { code: '2022' }, lineSpacingMultiple: 1.15 });
  footer(s, 7);
}

/* --------------------------------------------- 8. Kockázat, kontroll, kérés */
{
  const s = slide('Kockázat, kontroll — és mit kérünk', 'döntés');
  const risks = [
    ['Legnagyobb kockázat', 'Nem megfelelő vagy már nem elérhető növény kerül az ajánlatba.'],
    ['Kontroll', 'Minden ajánlatot ember hagy jóvá. Determinisztikus ellenőrzés: keret, készlet, üres csomag, alacsony biztonság → eszkaláció.'],
    ['Visszavehetőség', 'A webes bejárat percek alatt kikapcsolható, a kézi folyamat érintetlen. Egy téves ajánlat visszavonása: az ügy újranyitása, az ügyfélnek nem ment ki ígéret.'],
    ['Adat és hozzáférés', 'A modell csak szobajellemzőket kap. A katalógus read-only, három rétegben védve — az agent nem tud írni.'],
  ];
  let y = 1.2;
  risks.forEach(([t, d]) => {
    card(s, { x: M, y, w: 9, h: 0.72, accent: TERRA });
    s.addText(t, { x: 0.7, y: y + 0.05, w: 2.0, h: 0.6, fontFace: F, fontSize: 10, bold: true, color: TERRA, valign: 'middle' });
    s.addText(d, { x: 2.75, y: y + 0.05, w: 6.55, h: 0.6, fontFace: F, fontSize: 9.5, color: INK, valign: 'middle', lineSpacingMultiple: 1.1 });
    y += 0.82;
  });
  card(s, { x: M, y: 4.48, w: 9, h: 0.6, fill: FOREST, border: FOREST });
  s.addText('A kérésünk: 1,3 M Ft egyszeri keret és heti 2 óra lakberendezői idő egy 8 hetes, 5 ügyféles pilotra — döntési ponttal a 4. héten.', {
    x: 0.7, y: 4.53, w: 8.6, h: 0.5, fontFace: F, fontSize: 11.5, bold: true, color: 'FFFFFF', valign: 'middle' });
  footer(s, 8);
}

pptx.writeFile({ fileName: process.argv[2] }).then((f) => console.log('kész:', f));
