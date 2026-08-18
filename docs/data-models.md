# Adatmodell

> Quik scan · 2026-07-17 · forrás: [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)

## Áttekintés

- **Adatbázis:** PostgreSQL 17
- **ORM:** Prisma 6 (csak séma/migráció/seed a read-write kapcsolaton)
- **Modellek száma:** 1 (`Product`)
- **Konvenció:** mezők camelCase, oszlopok snake_case (`@map`), tábla `products` (`@@map`)

## `Product` → tábla `products`

A növény-katalógus egyetlen táblája. Ez felett fut a query agent read-only SQL-je.

| Mező (camelCase) | Oszlop (snake_case) | Típus | Megjegyzés |
|------------------|---------------------|-------|------------|
| `id` | `id` | `Int` PK, autoincrement | |
| `name` | `name` | `String` | magyar név |
| `latinName` | `latin_name` | `String` | botanikai (latin) név — természetes kulcs az upsertnél |
| `category` | `category` | `String` | szobanövény \| kerti \| pozsgás \| kaktusz \| fűszer \| fa-cserje \| lógó \| virágzó |
| `location` | `location` | `String` | beltéri \| kültéri \| mindkettő |
| `price` | `price` | `Decimal(12,2)` | ár (HUF) |
| `salePrice` | `sale_price` | `Decimal(12,2)?` | akciós ár, `null` ha nincs akció |
| `stock` | `stock` | `Int` | raktárkészlet (db) |
| `light` | `light` | `String` | árnyék \| alacsony \| közepes \| erős \| direkt nap |
| `watering` | `watering` | `String` | ritka \| közepes \| gyakori \| állandóan nedves |
| `difficulty` | `difficulty` | `String` | kezdő \| haladó \| profi |
| `currentHeightCm` | `current_height_cm` | `Int` | jelenlegi magasság (cm) |
| `maxHeightCm` | `max_height_cm` | `Int` | maximális magasság (cm) |
| `currentPotCm` | `current_pot_cm` | `Int` | jelenlegi cserép átmérő (cm) |
| `petSafe` | `pet_safe` | `Boolean` | háziállatra biztonságos |
| `kidSafe` | `kid_safe` | `Boolean` | gyerekre biztonságos |
| `airPurifying` | `air_purifying` | `Boolean` | légtisztító |
| `rating` | `rating` | `Decimal(3,2)` | 0–5 |
| `reviewsCount` | `reviews_count` | `Int` | értékelések száma |
| `description` | `description` | `String` | leírás |

## Migrációk

| Migráció | Tartalom |
|----------|----------|
| `20260629155056_init_products` | `products` tábla létrehozása |

## Seed

- Belépő: `packages/db/prisma/seed.ts` (`pnpm db:seed`, idempotens, ~30 növény).
- A gyökér `seed/` mappa is tartalmaz seed-adatot és `knowledge/`-et (`plants.ts`, `seed.ts`).
- Az `upsertProduct` tool `latin_name`-re kulcsolva idempotensen ír (ingest agent).

## Hiányzó (tervezett) modellek

A [CLAUDE.md](../CLAUDE.md) növénycsomag-flow-t ír le a következő táblákkal, de ezek **még nincsenek a sémában**:

- `packages` — mentett növénycsomagok
- `package_items` — csomag tételei
- `customers` — ügyfelek (FK cél a `packages`-hez)

Ezek egy jövőbeli epic részei; a jelenlegi séma csak a `Product`-ot tartalmazza.
