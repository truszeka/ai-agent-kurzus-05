# Architektúra — `@plantbase/web` (web)

> Quick scan · 2026-07-17 · típus: web frontend

## Összefoglaló

React + Vite **chat-felület**, amely a `@plantbase/server`-en át beszél az agenttel. A `@ai-sdk/react` kezeli a streaming chat-állapotot; a UI shadcn/ui + Radix komponensekre és Tailwindre épül.

## Technológiai stack

| Kategória | Technológia |
|-----------|-------------|
| Keret | React 19 (`react`, `react-dom`) |
| Build/dev | Vite (`@vitejs/plugin-react`, `vite`) |
| LLM kliens | `@ai-sdk/react`, `ai` |
| Stílus | Tailwind CSS (`@tailwindcss/vite`, `@tailwindcss/typography`) |
| Komponensek | shadcn/ui (`@shadcn/react`), Radix (`radix-ui`, `@radix-ui/react-slot`) |
| Ikonok | `lucide-react` |
| Markdown | `react-markdown`, `remark-gfm` |
| Segéd | `clsx`, `tailwind-merge`, `class-variance-authority` |

## Struktúra

```
apps/web/
├── index.html
├── vite.config.ts
└── src/
    ├── main.tsx            # React belépő
    ├── App.tsx             # Chat felület (@ai-sdk/react)
    ├── components/ui/
    │   ├── button.tsx
    │   ├── input.tsx
    │   └── message-scroller.tsx
    ├── lib/utils.ts        # cn() (clsx + tailwind-merge)
    └── styles.css          # Tailwind
```

## Komponens-leltár (quick scan)

| Komponens | Kategória | Szerep |
|-----------|-----------|--------|
| `App.tsx` | Oldal | Chat konténer, üzenetkezelés |
| `button.tsx` | Form/UI | shadcn gomb |
| `input.tsx` | Form/UI | szövegbeviteli mező |
| `message-scroller.tsx` | Display | üzenetlista görgetése |

## Futtatás / build

```bash
pnpm web        # nx dev web (Vite dev szerver)
pnpm nx build web
```

## Deploy

Railpack (`railpack.web.json`): `pnpm exec nx build web` → statikus kiszolgálás:
```
npx --yes serve -s apps/web/dist -l ${PORT:-4200}
```
