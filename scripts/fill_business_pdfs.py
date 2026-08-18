from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
pdfmetrics.registerFont(TTFont("DV", FONT))
pdfmetrics.registerFont(TTFont("DVB", FONT_BOLD))

BLUE = (0.08, 0.35, 0.85)
GREEN = (0.10, 0.48, 0.23)
BLACK = (0.10, 0.10, 0.10)
WHITE = (1, 1, 1)


def whiteout(c, x, y, w, h):
    c.setFillColorRGB(*WHITE)
    c.setStrokeColorRGB(*WHITE)
    c.rect(x, y, w, h, fill=1, stroke=0)


def text(c, x, y, value, size=7, bold=False, color=BLACK):
    c.setFont("DVB" if bold else "DV", size)
    c.setFillColorRGB(*color)
    c.drawString(x, y, value)


def wrapped(c, x, top, width, value, size=7, leading=None, bold=False, max_lines=None, color=BLACK):
    leading = leading or size * 1.25
    font = "DVB" if bold else "DV"
    words = value.split()
    lines = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    if max_lines:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    for i, line in enumerate(lines):
        c.drawString(x, top - i * leading, line)


def mark(c, x, y, value="X", color=BLUE):
    text(c, x, y, value, 8, True, color)


def overlay_pdf(page_drawers):
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=(595.92, 842.88))
    for drawer in page_drawers:
        drawer(c)
        c.showPage()
    c.save()
    packet.seek(0)
    return PdfReader(packet)


def merge(template_name, output_name, page_drawers):
    base = PdfReader(DOCS / template_name)
    overlay = overlay_pdf(page_drawers)
    writer = PdfWriter()
    for original, added in zip(base.pages, overlay.pages):
        original.merge_page(added)
        writer.add_page(original)
    with (DOCS / output_name).open("wb") as target:
        writer.write(target)


def use_case_page_1(c):
    # Header
    whiteout(c, 38, 756, 520, 40)
    text(c, 38, 783, "Személyre szabott növénycsomag-ajánlat elkészítése", 11, True)
    text(c, 38, 758, "Terület: lakberendezési tanácsadás", 6.5)
    text(c, 205, 758, "Folyamatgazda: vezető lakberendező", 6.5)
    text(c, 405, 758, "Kitöltötte: fejlesztés", 6.5)
    text(c, 493, 748, "2026.08.18", 6.5)

    # Section 1, answer column
    answers = ["Igen", "Igen", "Részben", "Nem", "Igen"]
    ys = [676, 641, 606, 571, 536]
    for answer, y in zip(answers, ys):
        text(c, 438, y, answer, 7, answer == "Igen", BLUE if answer == "Igen" else BLACK)

    # Current process prose and row
    whiteout(c, 48, 450, 500, 42)
    wrapped(c, 49, 486, 495,
            "A lakberendező az ügyfél szobaadatait e-mailből vagy jegyzetből olvassa ki, majd kézzel keres a webshopban. Ellenőrzi a méretet, készletet, akciót és a keretet, aztán megfogalmazza az ajánlatot. Az ügyfél csak kérdezéssel tudja meg, hol tart az ügye.",
            6.5, 8, max_lines=4)
    whiteout(c, 49, 407, 495, 31)
    wrapped(c, 51, 430, 113, "Lakberendező", 6.3, 7, max_lines=2)
    wrapped(c, 173, 430, 116, "Ügyfél webes űrlapja", 6.3, 7, max_lines=2)
    wrapped(c, 296, 430, 117, "Ellenőrzött növénycsomag", 6.3, 7, max_lines=2)
    wrapped(c, 422, 430, 119, "Lakberendező ellenőrzi a megfelelést", 6.3, 7, max_lines=3)

    # Baseline table
    rows = [
        ("15 eset/hó", "Becsült", "BRS: 5 ügyfél x 3 szoba"),
        ("12,5 perc", "Becsült", "BRS: 10-15 perc/szoba"),
        ("1 munkanap", "Becsült", "Folyamatgazdai becslés; piloton mérendő"),
        ("nincs adat", "Mérendő", "Jóváhagyási napló a pilotban"),
        ("0% státusz", "Becsült", "Jelenlegi folyamatleírás"),
    ]
    y_values = [329, 307, 285, 263, 241]
    for (value, kind, source), y in zip(rows, y_values):
        text(c, 199, y, value, 6.2)
        text(c, 307, y, kind, 6.2)
        wrapped(c, 397, y + 2, 139, source, 5.6, 6.4, max_lines=2)

    # Return dimensions
    marks = [(50, 171), (50, 135), (299, 153), (299, 135)]
    for x, y in marks:
        mark(c, x, y)


def use_case_page_2(c):
    # Ratings: selected circle x positions are approx 305,320,334,348,362 for 1..5.
    for score, y in [(2, 721), (2, 700), (4, 678), (2, 616), (2, 594), (2, 551), (2, 529), (2, 507)]:
        mark(c, 298 + score * 14, y, "X", GREEN)

    explanations = [
        (418, 724, "~1,1 M Ft/év kapacitás, becslés"),
        (418, 702, "5 ügyfél, kb. 15 szoba/hó"),
        (418, 680, "Lassú, ismétlődő keresés"),
        (418, 618, "Meglevő agent + 3 webes nézet"),
        (418, 596, "Katalógus read-only, helyi ügytár"),
        (418, 553, "Vezető lakberendező: heti 2 óra"),
        (418, 531, "A végső kontroll embernél marad"),
        (418, 509, "Alacsony kockázatú tanácsadási PoC"),
    ]
    for x, y, value in explanations:
        whiteout(c, x - 2, y - 3, 120, 13)
        wrapped(c, x, y + 3, 115, value, 5.6, 6.2, max_lines=2)
    text(c, 365, 657, "8 / 15", 8, True, BLUE)
    text(c, 365, 466, "10 / 25", 8, True, BLUE)

    # Exclusion checklist: all prerequisites are assumed for the proposed pilot.
    for x, y in [(49, 385), (49, 363), (49, 341), (299, 385), (299, 363), (299, 341)]:
        mark(c, x, y, "X", GREEN)

    # Verdict and next step
    mark(c, 55, 259, "X", GREEN)
    whiteout(c, 56, 209, 470, 31)
    wrapped(c, 58, 233, 465,
            "A fejlesztés 2026.09.01-ig előkészít egy 8 hetes, 5 ügyféles pilotot; a folyamatgazda az első két hétben baseline-t és minőséget mér.",
            7, 9, max_lines=3)

    # Shortlist
    text(c, 52, 155, "Növénycsomag-ajánló", 6.1, True)
    text(c, 221, 155, "8/15", 6.1)
    text(c, 288, 155, "10/25", 6.1)
    text(c, 360, 155, "quick win", 6.1)
    text(c, 474, 155, "Business case", 6.1, True, GREEN)


def business_page_1(c):
    # Header
    whiteout(c, 38, 755, 530, 42)
    text(c, 38, 782, "Plantbase személyre szabott növénycsomag-ajánló", 11, True)
    text(c, 38, 756, "Szponzor: e-commerce igazgató", 6.2)
    text(c, 180, 756, "Folyamatgazda: vezető lakberendező", 6.2)
    text(c, 385, 756, "Készítette: fejlesztés", 6.2)
    text(c, 501, 746, "2026.08.18", 6.2)

    # Sponsor sentence
    whiteout(c, 50, 668, 500, 45)
    wrapped(c, 51, 704, 495,
            "Az agent az ügyfél szobájához és keretéhez katalógus-alapú növénycsomagot készít, így a lakberendező munkája 12,5 percről legfeljebb 5 percre csökken szobánként, emberi jóváhagyás mellett.",
            8, 10, True, max_lines=4)

    # AS-IS / TO-BE table
    rows = [
        ("Munkaidő / szoba", "12,5 perc", "legfeljebb 5 perc", "BRS-becslés; pilot időbélyeg"),
        ("Ajánlat átfutása", "1 munkanap", "15 percen belül", "Becsült; ügynapló"),
        ("Volumen", "15 szoba/hó", "15 szoba/hó", "BRS: 5 ügyfél x 3 szoba"),
        ("Emberi javítási arány", "nincs adat", "legfeljebb 30%", "Pilot jóváhagyási napló"),
    ]
    y_values = [601, 562, 523, 484]
    for (metric, baseline, target, source), y in zip(rows, y_values):
        wrapped(c, 57, y + 6, 112, metric, 6.1, 7, max_lines=2)
        text(c, 185, y + 2, baseline, 6.1)
        text(c, 312, y + 2, target, 6.1)
        wrapped(c, 438, y + 6, 103, source, 5.5, 6.2, max_lines=3)

    # The number
    whiteout(c, 52, 365, 480, 53)
    text(c, 62, 389, "1,1 M Ft / év kapacitás-megtakarítás", 12, True, BLUE)
    text(c, 422, 389, "BECSÜLT", 7, True, (0.72, 0.43, 0.05))
    whiteout(c, 51, 327, 500, 28)
    wrapped(c, 51, 349, 495,
            "15 szoba/hó x 7,5 megtakarított perc x 8 000 Ft/óra x 12 hó = 1,08 M Ft/év. A baseline a BRS 10-15 perces becslésének középértéke.",
            6.7, 8, max_lines=3)

    # Cost table
    costs = [
        ("900 e Ft", "-", "PoC web, workflow, naplózás"),
        ("250 e Ft", "-", "Katalógus és helyi ügytár"),
        ("150 e Ft", "-", "8 hetes pilot, heti 2 óra"),
        ("-", "180 e Ft", "Becsült modellhasználat"),
        ("-", "240 e Ft", "Gazda: e-commerce csapat"),
        ("1 300 e Ft", "420 e Ft", "Megtérülés: ~20 hónap"),
    ]
    ys = [244, 216, 188, 159, 130, 101]
    for (oneoff, annual, note), y in zip(costs, ys):
        text(c, 289, y, oneoff, 6.0, y == 101)
        text(c, 399, y, annual, 6.0, y == 101)
        wrapped(c, 488, y + 3, 64, note, 5.2, 5.8, max_lines=3, bold=y == 101)

    # Risks
    whiteout(c, 48, 19, 510, 65)
    wrapped(c, 50, 77, 245, "Legnagyobb kockázat: nem megfelelő vagy nem elérhető növény kerül az ajánlatba.", 5.4, 6.2, max_lines=3)
    wrapped(c, 50, 57, 245, "Emberi kapu: minden ajánlatot lakberendező hagy jóvá az ügyfél előtt.", 5.4, 6.2, max_lines=3)
    wrapped(c, 50, 37, 245, "Visszavehetőség: a webes bejárat percek alatt kikapcsolható; a kézi folyamat megmarad.", 5.4, 6.2, max_lines=3)
    wrapped(c, 310, 77, 245, "Adat: a modell csak szobajellemzőket kap; név és e-mail a helyi ügytárban marad.", 5.4, 6.2, max_lines=3)
    wrapped(c, 310, 57, 245, "Besorolás: alacsony kockázatú ajánlás; belső adatvédelmi ellenőrzés kell.", 5.4, 6.2, max_lines=3)
    wrapped(c, 310, 37, 245, "Napló: kérés, SQL, találatok, ajánlat, státusz, döntés, idő és költség.", 5.4, 6.2, max_lines=3)


def business_page_2(c):
    whiteout(c, 50, 747, 500, 52)
    wrapped(c, 51, 790, 495,
            "Kérünk legfeljebb 1,3 M Ft egyszeri keretet és a vezető lakberendező heti 2 óráját egy 8 hetes, 5 ügyféles pilothoz, döntési ponttal a 4. héten.",
            9, 11, True, max_lines=4)

    rows = [
        ("Pilot indul, 5 ügyfél", "2026.09.01", "Működik-e a teljes folyamat?"),
        ("Döntési pont", "2026.09.28", "Eléri-e az 5 percet és <=30% javítást?"),
        ("Teljes szolgáltatás, gazdával", "2026.11.15", "Bevezetjük, bővítjük vagy leállítjuk?"),
    ]
    ys = [700, 659, 618]
    for (milestone, date, decision), y in zip(rows, ys):
        wrapped(c, 57, y + 7, 155, milestone, 6.5, 7.5, max_lines=2)
        text(c, 232, y + 2, date, 6.5)
        wrapped(c, 349, y + 7, 190, decision, 6.2, 7.2, max_lines=3)


P_BLUE = colors.HexColor("#1769e0")
P_AMBER = colors.HexColor("#a96800")
P_RED = colors.HexColor("#bb2e27")
P_GREEN = colors.HexColor("#18763b")
P_GRID = colors.HexColor("#d7dbe1")
P_HEADER = colors.HexColor("#f1f3f6")
P_TEXT = colors.HexColor("#202124")


def styles():
    return {
        "title": ParagraphStyle("title", fontName="DVB", fontSize=15, leading=18, textColor=P_TEXT, spaceAfter=5 * mm),
        "meta": ParagraphStyle("meta", fontName="DV", fontSize=7.3, leading=9, textColor=P_TEXT),
        "section": ParagraphStyle("section", fontName="DVB", fontSize=9, leading=11, textColor=P_BLUE, spaceBefore=3 * mm, spaceAfter=2 * mm),
        "amber": ParagraphStyle("amber", fontName="DVB", fontSize=9, leading=11, textColor=P_AMBER, spaceBefore=3 * mm, spaceAfter=2 * mm),
        "red": ParagraphStyle("red", fontName="DVB", fontSize=9, leading=11, textColor=P_RED, spaceBefore=3 * mm, spaceAfter=2 * mm),
        "body": ParagraphStyle("body", fontName="DV", fontSize=7.5, leading=10, textColor=P_TEXT, spaceAfter=2 * mm),
        "small": ParagraphStyle("small", fontName="DV", fontSize=6.4, leading=8, textColor=P_TEXT),
        "small_bold": ParagraphStyle("small_bold", fontName="DVB", fontSize=6.4, leading=8, textColor=P_TEXT),
        "statement": ParagraphStyle("statement", fontName="DVB", fontSize=10, leading=13, textColor=P_TEXT, spaceAfter=2 * mm),
        "number": ParagraphStyle("number", fontName="DVB", fontSize=16, leading=19, textColor=P_BLUE, alignment=TA_CENTER),
    }


def para(value, style):
    return Paragraph(value, style)


def make_table(data, widths, s, header=True, row_heights=None):
    converted = []
    for row_index, row in enumerate(data):
        style = s["small_bold"] if header and row_index == 0 else s["small"]
        converted.append([cell if hasattr(cell, "wrap") else para(str(cell), style) for cell in row])
    table = Table(converted, colWidths=widths, rowHeights=row_heights, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.45, P_GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands += [("BACKGROUND", (0, 0), (-1, 0), P_HEADER), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#555b65"))]
    table.setStyle(TableStyle(commands))
    return table


def footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setStrokeColor(P_GRID)
    canvas_obj.line(15 * mm, 13 * mm, 195 * mm, 13 * mm)
    canvas_obj.setFont("DV", 6.5)
    canvas_obj.setFillColor(colors.HexColor("#666666"))
    canvas_obj.drawString(15 * mm, 8 * mm, "robot_dreams / AI ágensfejlesztés / 12. óra")
    canvas_obj.drawRightString(195 * mm, 8 * mm, f"{doc.page}. oldal")
    canvas_obj.restoreState()


def doc_header(story, s, title, meta):
    story.append(para(title, s["title"]))
    story.append(make_table([meta], [45 * mm, 57 * mm, 48 * mm, 30 * mm], s, header=False))
    story.append(Spacer(1, 3 * mm))


def section(story, s, number, title, color="section"):
    story.append(para(f"{number} / {title}", s[color]))


def build_use_case():
    s = styles()
    out = DOCS / "ora12-3-kitoltott.pdf"
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=17 * mm)
    story = []
    doc_header(story, s, "USE CASE FELMÉRŐ / Személyre szabott növénycsomag-ajánlat", [
        "Terület: lakberendezési tanácsadás", "Folyamatgazda: vezető lakberendező", "Kitöltötte: fejlesztés", "Dátum: 2026.08.18"
    ])

    section(story, s, "1", "MELYIK KÉRDÉSRE VÁLASZ")
    story.append(make_table([
        ["AZ ÖT KÉRDÉS, AMIVEL USE CASE-T TALÁLSZ", "EZ AZ?", "INDOKLÁS"],
        ["Mi az, amit hetente többször ugyanúgy csinálunk?", "IGEN", "Katalóguskeresés és csomag-ellenőrzés."],
        ["Hol várunk valakire, aki csak átnéz és továbbenged?", "IGEN", "Az ajánlatot lakberendező ellenőrzi."],
        ["Mit nehéz elmagyarázni egy új kollégának?", "RÉSZBEN", "A katalógusszűrés és kompromisszumok."],
        ["Melyik hibából lett tényleges kár vagy bírság?", "NEM", "Nincs igazolt kár- vagy bírságadat."],
        ["Mire mondjuk azt, hogy erre sosincs időnk?", "IGEN", "Személyre szabott ajánlat minden ügyfélnek."],
    ], [91 * mm, 22 * mm, 67 * mm], s))

    section(story, s, "2", "A FOLYAMAT MA, MUNKANAPKÉNT")
    story.append(para("A lakberendező az ügyfél szobaadatait e-mailből vagy jegyzetből olvassa ki, majd kézzel keres a webshopban. Ellenőrzi a méretet, készletet, akciót és a keretet, aztán megfogalmazza az ajánlatot. Az ügyfél csak kérdezéssel tudja meg, hol tart az ügye.", s["body"]))
    story.append(make_table([
        ["KI CSINÁLJA", "MI INDÍTJA", "MI A KIMENET", "HOL DŐL EL, HOGY JÓ-E"],
        ["Lakberendező", "Ügyfél e-mailje vagy jegyzete", "Ellenőrzött növénycsomag-ajánlat", "A lakberendező szakmai ellenőrzése alapján"],
    ], [35 * mm, 45 * mm, 48 * mm, 52 * mm], s))

    section(story, s, "3", "VOLUMEN ÉS BASELINE, AMIT TÉNYLEG MEG TUDSZ MÉRNI")
    story.append(make_table([
        ["MIT MÉRÜNK", "MAI ÉRTÉK", "MÉRT / BECSÜLT", "HONNAN VAN A SZÁM"],
        ["Esetszám / hó", "15 szoba", "Becsült", "BRS: 5 ügyfél x 3 szoba"],
        ["Munkaidő / eset", "12,5 perc", "Becsült", "BRS: 10-15 perc/szoba középértéke"],
        ["Átfutási idő", "1 munkanap", "Becsült", "Folyamatgazdai becslés; piloton mérendő"],
        ["Hibaarány / újramunka", "Nincs adat", "Mérendő", "Pilot jóváhagyási napló"],
        ["Ügyféloldali státusz", "Nincs", "Becsült", "Jelenlegi folyamatleírás"],
    ], [42 * mm, 34 * mm, 35 * mm, 69 * mm], s))

    section(story, s, "4", "HOL KELETKEZIK A MEGTÉRÜLÉS")
    story.append(make_table([
        ["X", "PEREX, személyi költség", "", "Kockázat és hibaköltség"],
        ["X", "Akvizíció, jobb konverzió", "", "Tranzakció, gyorsabb pénzforgás"],
        ["X", "Áteresztőképesség, több ügy", "X", "Ügyfélélmény, NPS és churn (soft)"],
    ], [8 * mm, 82 * mm, 8 * mm, 82 * mm], s, header=False))

    story.append(PageBreak())
    doc_header(story, s, "USE CASE FELMÉRŐ / Hatás, teher és döntés", [
        "Use case: növénycsomag-ajánló", "Folyamatgazda: vezető lakberendező", "Státusz: javaslat", "Dátum: 2026.08.18"
    ])
    section(story, s, "5", "HATÁS ÉS VALÓDI BEVEZETÉSI TEHER", "amber")
    story.append(make_table([
        ["SZEMPONT", "PONT (1-5)", "EGY MONDAT INDOKLÁS"],
        ["HATÁS: éves pénzügyi nagyságrend", "2", "Kb. 1,1 M Ft/év kapacitás; becslés."],
        ["HATÁS: hány embert érint naponta", "2", "Kb. 5 ügyfél és 15 szoba havonta."],
        ["HATÁS: mennyire fáj ma", "4", "Lassú, ismétlődő keresés; nincs státusz."],
        ["HATÁS ÖSSZESEN", "8 / 15", ""],
        ["TEHER: fejlesztés", "2", "Meglevő agent, plusz három webes nézet."],
        ["TEHER: integráció és adathozzáférés", "2", "Read-only katalógus és helyi ügytár."],
        ["TEHER: betanítás és párhuzamos üzem", "2", "Vezető lakberendező heti 2 órája."],
        ["TEHER: ellenállás és megszokás", "2", "A végső kontroll az embernél marad."],
        ["TEHER: compliance és jóváhagyás", "2", "Alacsony kockázatú tanácsadási PoC."],
        ["TEHER ÖSSZESEN", "10 / 25", ""],
    ], [78 * mm, 28 * mm, 74 * mm], s))

    section(story, s, "6", "KIZÁRÓ KÉRDÉSEK, MIELŐTT TOVÁBB VISZED", "red")
    story.append(make_table([
        ["X", "Van szponzor: e-commerce igazgató", "X", "Van emberi jóváhagyási pont"],
        ["X", "Van folyamatgazda: vezető lakberendező", "X", "Az AI Act besorolás tisztázható"],
        ["X", "Az adat digitális, elérhető és jogosítható", "X", "A hiba elviselhető, a folyamat visszaállítható"],
    ], [8 * mm, 82 * mm, 8 * mm, 82 * mm], s, header=False))

    section(story, s, "7", "VERDIKT ÉS KÖVETKEZŐ LÉPÉS")
    story.append(para("<b>VISZEM BUSINESS CASE-BE.</b> A fejlesztés 2026.09.01-ig előkészít egy 8 hetes, 5 ügyféles pilotot; a folyamatgazda az első két hétben baseline-t és minőséget mér.", s["body"]))

    section(story, s, "8", "SHORTLIST")
    story.append(make_table([
        ["USE CASE", "HATÁS", "TEHER", "MEZŐ", "VERDIKT"],
        ["Személyre szabott növénycsomag-ajánló", "8/15", "10/25", "Quick win", "Business case-be viszem"],
    ], [74 * mm, 22 * mm, 22 * mm, 28 * mm, 34 * mm], s))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_business_case():
    s = styles()
    out = DOCS / "ora12-1-kitoltott.pdf"
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=17 * mm)
    story = []
    doc_header(story, s, "BUSINESS CASE / Plantbase növénycsomag-ajánló", [
        "Szponzor: e-commerce igazgató", "Folyamatgazda: vezető lakberendező", "Készítette: fejlesztés", "Dátum: 2026.08.18"
    ])
    section(story, s, "1", "EGY MONDAT, AMIT A SZPONZOR FELMOND")
    story.append(para("Az agent az ügyfél szobájához és keretéhez katalógus-alapú növénycsomagot készít, így a lakberendező munkája 12,5 percről legfeljebb 5 percre csökken szobánként, emberi jóváhagyás mellett.", s["statement"]))

    section(story, s, "2", "AS-IS ÉS TO-BE")
    story.append(make_table([
        ["MIT MÉRÜNK", "AS-IS (BASELINE)", "TO-BE (AGENTTEL)", "HONNAN TUDJUK"],
        ["Munkaidő / szoba", "12,5 perc", "legfeljebb 5 perc", "BRS-becslés; pilot időbélyeg"],
        ["Ajánlat átfutása", "1 munkanap", "15 percen belül", "Becsült; ügynapló"],
        ["Volumen", "15 szoba/hó", "15 szoba/hó", "BRS: 5 ügyfél x 3 szoba"],
        ["Emberi javítási arány", "nincs adat", "legfeljebb 30%", "Pilot jóváhagyási napló"],
    ], [43 * mm, 40 * mm, 43 * mm, 54 * mm], s))
    story.append(para("A baseline-ok becslések, ezért a pilot első két hete kötelező mérési szakasz.", s["small"]))

    section(story, s, "3", "A SZÁM")
    number_box = Table([[para("1,1 M Ft / év kapacitás-megtakarítás (BECSÜLT)", s["number"])]], colWidths=[180 * mm])
    number_box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), P_HEADER), ("BOX", (0, 0), (-1, -1), .6, P_GRID), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    story.append(number_box)
    story.append(Spacer(1, 2 * mm))
    story.append(para("15 szoba/hó x 7,5 megtakarított perc x 8 000 Ft/óra x 12 hó = 1,08 M Ft/év. A baseline a BRS 10-15 perces becslésének középértéke.", s["body"]))

    section(story, s, "4", "KÖLTSÉG ÉS IDŐ (FELSŐ BECSLÉS)", "amber")
    story.append(make_table([
        ["TÉTEL", "EGYSZERI", "ÉVES", "MEGJEGYZÉS"],
        ["Fejlesztés", "900 e Ft", "-", "PoC web, workflow, naplózás"],
        ["Integráció, adat, jogosultság", "250 e Ft", "-", "Katalógus és helyi ügytár"],
        ["Betanítás, párhuzamos üzem", "150 e Ft", "-", "8 hetes pilot, heti 2 óra"],
        ["Licenc és modellhasználat", "-", "180 e Ft", "Becsült, adopcióval nő"],
        ["Üzemeltetés és támogatás", "-", "240 e Ft", "Gazda: e-commerce csapat"],
        ["ÖSSZESEN", "1 300 e Ft", "420 e Ft", "Megtérülés: kb. 20 hónap"],
    ], [60 * mm, 30 * mm, 28 * mm, 62 * mm], s))
    story.append(para("Felfutás: 1. hónap 20%, 3. hónap 60%, 6. hónaptól 85%. A haszon alsó, a költség felső becslés.", s["small"]))

    story.append(PageBreak())
    doc_header(story, s, "BUSINESS CASE / Kockázat és döntés", [
        "Projekt: Plantbase", "Use case: növénycsomag-ajánló", "Státusz: pilotjavaslat", "Dátum: 2026.08.18"
    ])
    section(story, s, "5", "KOCKÁZAT ÉS MI TÖRTÉNIK, HA ROSSZUL MEGY", "amber")
    story.append(make_table([
        ["KÉRDÉS", "VÁLASZ A SAJÁT PoC-RA"],
        ["Legnagyobb kockázat", "Nem megfelelő vagy már nem elérhető növény kerül az ajánlatba."],
        ["Emberi kapu", "Minden ajánlatot lakberendező hagy jóvá, mielőtt az ügyfél láthatja."],
        ["Visszavehetőség", "A webes bejárat percek alatt kikapcsolható; a korábbi kézi folyamat megmarad."],
        ["Adat és hozzáférés", "A modell csak szobajellemzőket kap. Név és e-mail a helyi ügytárban marad; az adminfelületet csak a lakberendező éri el."],
        ["Szabályozói besorolás", "Alacsony kockázatú ajánlási PoC; indulás előtt belső adatvédelmi ellenőrzés szükséges."],
        ["Naplózás és audit", "Naplózzuk a kérést, generált SQL-t, találatokat, ajánlatot, bizonytalanságot, státuszt, emberi döntést, időt és modellköltséget."],
    ], [48 * mm, 132 * mm], s))

    section(story, s, "6", "MIT KÉRÜNK")
    story.append(para("Kérünk legfeljebb 1,3 M Ft egyszeri keretet és a vezető lakberendező heti 2 óráját egy 8 hetes, 5 ügyféles pilothoz, döntési ponttal a 4. héten.", s["statement"]))
    story.append(make_table([
        ["MÉRFÖLDKŐ", "MIKORRA", "MI A DÖNTÉS A VÉGÉN"],
        ["Pilot indul, 5 ügyfél", "2026.09.01", "Végigmegy-e a teljes folyamat, emberi kapuval?"],
        ["Döntési pont", "2026.09.28", "Eléri-e az 5 percet és a legfeljebb 30%-os javítási arányt?"],
        ["Teljes szolgáltatás, gazdával", "2026.11.15", "Bevezetjük, bővítjük vagy leállítjuk?"],
    ], [57 * mm, 32 * mm, 91 * mm], s))
    story.append(Spacer(1, 4 * mm))
    story.append(para("Döntési minimum: a PoC stabilan elindul; mind a sikeres, mind az eszkalált eset végigmegy; nincs jóváhagyás nélküli ajánlat; a mérési adatok naplóból visszakereshetők.", s["body"]))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    build_use_case()
    build_business_case()


if __name__ == "__main__":
    main()
