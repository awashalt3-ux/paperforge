# Contributing to Paperforge

Thanks for lending a hand. Paperforge is a local-first PDF studio, and the goal is to keep it
professional, predictable, and pleasant to use. This guide covers the workflow and the house rules.

## Getting set up

```bash
npm install
npm run dev
```

Node.js 20+ is required. The dev server runs on `http://127.0.0.1:5173`; there is no backend.

Before opening a pull request, run the full check suite:

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium   # once
npm run test:e2e
```

## Project layout

```text
src/
  components/   App shell, shared UI, editor, PDF dialogs
  db/           Dexie schema, documents, assets, trash
  hooks/        Shared React hooks
  lib/          Formatting, download, zip, shortcuts, tips
  pages/        Dashboard, Templates, Tools, Help, Settings, Editor, 404
  services/     PDF import, rendering, export, print, tools, project files
  store/        Zustand preferences, UI, editor, and document stores
  templates/    Document builders and instantiation
  types/        Document, page, element, and asset types
  utils/        Geometry, page sizes, validation, colours, files
e2e/            Playwright specs and PDF fixtures
public/fonts/   Inter TTFs embedded by the PDF export engine
public/webfonts Self-hosted interface fonts (no CDN requests)
```

`docs/architecture.md` explains the data model, the three coordinate spaces, persistence, and the
testing strategy. Read it before changing export or geometry code.

## House rules

- **No network at runtime.** Fonts, workers, and assets are served with the app. A new dependency
  must not phone home. PDFs and images never leave the browser.
- **Documents are the source of truth.** Any mutation goes through `documentStore.updateActive`, so
  undo, autosave, and thumbnails stay consistent.
- **Never break the coordinate contract.** Editor space is PDF points with a top-left origin; PDF
  user space is bottom-left. Use the affine helpers in `src/utils/pdfGeometry.ts` instead of
  per-element hacks.
- **Respect the limits.** 120 MB per PDF, 25 MB per image, 500 pages per document, 10,000 elements
  per page, 60 undo snapshots.
- **Accessibility is not optional.** Every icon-only control needs an `aria-label`; dialogs need a
  title and description; colour is never the only signal.
- **Practice restraint in the UI.** The palette is warm paper and forge green. Reach for the
  existing components (`Button`, `PanelSection`, `TipCard`, `EmptyState` patterns) before adding
  new ones.

## Extension points

| Want to… | Do this |
| --- | --- |
| Add a template | Add a builder and a definition to `TEMPLATE_DEFINITIONS` in `src/templates/index.ts`, then extend `src/templates/index.test.ts`. |
| Add an element type | Extend the union in `src/types/document.ts`, add a Zod schema, a Konva renderer, property controls, and a branch in `pdfExport.ts`. |
| Add a PDF tool | Implement it in `src/services/pdfTools.ts`, validate before mutating, then wire the tool definition, options panel, and result handling in `ToolsPage.tsx`. Also add a `PDF_TOOL_LINKS` entry. |
| Add a shortcut | Add it to `src/lib/shortcuts.ts` and handle the key in `EditorPage.tsx`. The dialog and help page read from the same registry. |
| Add a tip | Append to `TIPS` in `src/lib/tips.ts` with the right `context`. |

## Commits and pull requests

- Keep commits focused and describe the behaviour change, not the files touched.
- Include tests for new logic: unit tests for pure functions and services, Playwright for user flows.
- Update `README.md` and `docs/architecture.md` when behaviour or the data model changes.
- Screenshots are welcome for visual changes; mention the browser and theme used.

## Reporting bugs

Include the browser and version, the steps to reproduce, the expected and actual result, and the
relevant console error. If a PDF triggers the bug, describe its page count and whether it was
imported or created in Paperforge. Do not attach confidential documents.
