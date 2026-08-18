# Golden Set — RAG Pipeline HF3

> **Kitöltés:** ez a sablon futtatás-függő adatokat vár. Futtasd le mind a 7 kérdést
> kétféleképpen — (a) **raw** (csak embedding-hasonlóság, rerank nélkül: ideiglenesen
> kommenteld ki a `rerankChunks` hívást a `search-knowledge-tool.ts`-ben és térj vissza
> a top-5 nyers találattal), majd (b) **full pipeline** (HyDE + embedding + Cohere rerank) —
> és töltsd ki a táblázatot a saját méréseiddel. Előfeltétel: `OPENAI_API_KEY`,
> `COHERE_API_KEY`, `ANTHROPIC_API_KEY` a `.env`-ben, és `pnpm cli knowledge-ingest` lefuttatva.

## Kérdések és eredmények

| # | Kérdés | Raw top-3 forrás | Full pipeline top-3 forrás | Rerank átrendezett? | Megjegyzés |
|---|--------|-----------------|---------------------------|---------------------|------------|
| 1 | How often should I water a ZZ plant? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 2 | What plants are safe for cats? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 3 | Which plants survive in low light? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 4 | How do I deal with fungus gnats? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 5 | What is the best way to propagate plants? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 6 | How do I care for a succulent? | _(kitöltendő)_ | _(kitöltendő)_ | Igen/Nem | |
| 7 | *(NEGATÍV)* What is the exact weight in grams of a ripe pineapple fruit? | — | — | — | Nincs adat a tudásbázisban |

## Rerank hatása — részletes elemzés

_(Töltsd ki: melyik kérdésnél rendezett át a Cohere rerank a nyers embedding-sorrendhez
képest, és miért jobb az új sorrend. A HyDE-hipotetikus dokumentum és a valódi kérdés
közötti eltérés itt szokott látszani: a rerank a valódi kérdésre pontosít.)_

## Negatív teszt eredménye

_(Töltsd ki: a 7. kérdésre az agentnek a grounding-szabály szerint jeleznie kell, hogy erről
a témáról nincs információ a tudásbázisban — nem talál ki gramm-értéket. Másold ide a tényleges
válaszát.)_

## Futtatási környezet

- Embedding modell: `text-embedding-3-small` (dim=1536)
- Rerank modell: `rerank-english-v3.0`
- HyDE modell: `claude-haiku-4-5-20251001`
- similarity top-K: 20 · rerank top-N: 5 · min. relevancia: 0.30
