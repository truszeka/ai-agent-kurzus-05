# Tudásbázis karbantartás — architektúra-spec

> **Fájlnév-megjegyzés:** a HF3 feladat `ARCHITEKTURA.md`-t kért, de a repóban már létezik
> `docs/architektura.md` (a projekt fájlstruktúra-dokumentuma), és a fájlrendszer
> kis-nagybetű-érzéketlen (Windows/WSL), ezért az ütközés elkerülésére ez a fájl
> `tudasbazis-karbantartas.md` néven készült. Tartalmilag ez a kért „ARCHITEKTURA.md" —
> a tudásbázis-karbantartás architektúra-specifikációja.

Ez a dokumentum a `seed/knowledge/` cikkek RAG-indexének (a `knowledge_chunks` pgvector tábla)
**inkrementális** karbantartási tervét írja le. A jelenlegi `pnpm cli knowledge-ingest` parancs
teljes (idempotens) újraindexelést végez a `(doc_path, chunk_index)` unique kulcson keresztüli
upsert-tel; az alábbi terv ehhez ad hash-alapú change-detection réteget, hogy csak a valóban
megváltozott dokumentumok kerüljenek újra-embeddelésre (költség- és időmegtakarítás).

## Inkrementális frissítés terve

### Változásérzékelés

A `seed/knowledge/` mappában tárolt Markdown fájlok tartalmát SHA-256 hash-sel követjük.
A hash-eket egy `knowledge_doc_hashes` táblában tároljuk (`doc_path`, `content_hash`, `updated_at`).
Az ingest-script befutáskor összehasonlítja az aktuális fájl hash-ét a tárolttal:

- Ha egyezik → kihagyja (nem vektorizál újra).
- Ha eltér vagy új → újrachunkolja és újraembeddeli.

### Új dokumentum kezelése

1. A fájl megjelenik a `seed/knowledge/` mappában.
2. Az ingest-script detektálja (nincs hash-bejegyzés).
3. Chunkol → embeddel → upsert a `knowledge_chunks`-ba → hash mentése.

### Módosított dokumentum kezelése

1. Hash-összehasonlítás → eltérés detektálva.
2. A régi `doc_path`-hoz tartozó összes chunk DELETE-elése (mert a chunkok száma/sorrendje
   változhat, így a puszta upsert árva chunkokat hagyhatna hátra).
3. Újrachunkolás + embeddelés + upsert.
4. Hash frissítése.

### Törölt dokumentum kezelése

1. Az ingest-script a fájl-lista alapján detektálja, hogy egy korábban indexelt `doc_path` eltűnt.
2. `DELETE FROM knowledge_chunks WHERE doc_path = '...'`
3. Hash-bejegyzés törlése.

### Trigger

- **Manuális:** `pnpm cli knowledge-ingest` (fejlesztők, hotfix).
- **CI/CD:** GitHub Actions workflow fut, ha a `seed/knowledge/` mappában változás detektálható
  (`on: push: paths: ['seed/knowledge/**']`).
- **Scheduled:** heti cron (ha a forrás-URL-ek tartalmát is frissíteni kell — ez itt scope-on kívül).

## Adatmodell

`knowledge_chunks` (jelenlegi, Task 1):

| oszlop | típus | megjegyzés |
|--------|-------|------------|
| `id` | serial PK | |
| `doc_path` | text | természetes kulcs része |
| `doc_title` | text | frontmatter `title` |
| `doc_source` | text | frontmatter `source` (URL) |
| `category` | text | frontmatter `category` |
| `chunk_index` | int | 0-tól, dokumentumon belül |
| `heading` | text? | a szekció `##`/`###` címe |
| `content` | text | a chunk szövege (overlap-pel) |
| `embedding` | `vector(1536)` | pgvector |
| `created_at` | timestamptz | |

Unique kulcs: `(doc_path, chunk_index)` → idempotens upsert.

`knowledge_doc_hashes` (tervezett, inkrementális réteg):

| oszlop | típus |
|--------|-------|
| `doc_path` | text PK |
| `content_hash` | text (SHA-256) |
| `updated_at` | timestamptz |

## Architektúra-ábra

```
seed/knowledge/*.md
        │
        ▼
  [hash-check] ──── egyezik ──▶ SKIP
        │ eltér / új
        ▼
   chunkDocument()  (szekció-alapú, ## / ### mentén, overlap)
        │
        ▼
   embedTexts()  (OpenAI text-embedding-3-small, batch=100)
        │
        ▼
   upsertChunks()  (pgvector, ON CONFLICT (doc_path, chunk_index))
        │
        ▼
   knowledge_chunks tábla ◀── DELETE (törölt/módosított doc árva chunkjai)
```

_(Opcionálisan cseréld ki egy Miro/draw.io export képre: forrás → hash-check → chunk → embed →
pgvector → törlés/módosítás útja.)_
