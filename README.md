# Paperforge

A local-first PDF studio for designing, editing, and processing documents in the browser. Paperforge combines a Canva-style canvas editor with practical Acrobat-style PDF tools: create a document from scratch, import an existing PDF, edit a template, or run one of nine file operations — all without uploading a byte.

![Paperforge](public/favicon.svg)

**Live demo:** https://paperforge.wasmer.app/

## Highlights

- **Professional editor** — Konva canvas with page thumbnails, add/duplicate/rotate/reorder/delete pages, undo/redo (60 snapshots), zoom and pan, snap-to-grid, alignment guides, marquee and multi-select, layer ordering, locking, inline text editing, copy/cut/paste/duplicate, and keyboard shortcuts.
- **Real elements** — headings, paragraphs, notes, images, logos, tables, rectangles, ellipses, lines, highlights, and hand-drawn signatures.
- **Real PDF import** — PDF.js validates and renders the source while the original pages are preserved. Imported text is intentionally treated as fixed source content; add new text, images, signatures, highlights, and annotations on top.
- **Real PDF export** — pdf-lib draws vector text with embedded Inter fonts (via fontkit), images, shapes, tables, and overlays. Imported pages can be copied at original size or fitted onto a preset page size with correct rotation and margin handling. Metadata, page ranges, and progress are included.
- **Eight editable templates** — invoice, professional quotation, resume/CV, business letter, project proposal, meeting report, certificate, and contract.
- **Nine PDF tools** — merge, split, rotate, remove pages, reorder, images to PDF, watermark, page numbers, and extract pages. Each tool is deep-linkable (`/tools?tool=split`).
- **Search that works** — `Ctrl/Cmd+K` opens a real command palette covering recent documents, destinations, PDF tools, and create/import actions, with full keyboard navigation.
- **A 404 that helps** — unknown routes render a styled recovery page with document search, recent documents, destination cards, and create/import shortcuts.
- **Local-first persistence** — Dexie/IndexedDB autosave every 500 ms, document thumbnails, restore-on-open, portable project files, storage statistics, and reset controls.
- **Considered interface** — warm paper palette, forge-green accents, Inter/Newsreader/JetBrains Mono typography, light/dark/system themes, reduced-motion support, and desktop-first responsive layouts.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern Chromium, Firefox, or Safari browser with IndexedDB, Canvas, and File API support

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`). Everything runs in the tab; no backend or account is required.

### Production build

```bash
npm run build
npm run preview
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run typecheck` | Run strict TypeScript checks only. |
| `npm test` | Run Vitest unit tests. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run test:e2e:ui` | Open the Playwright UI. |

Before the first E2E run, install the browser binary:

```bash
npx playwright install chromium
```

## Using Paperforge

### Documents

Create a blank document from the sidebar or dashboard, choose a preset (A4, A5, US Letter, or custom millimetres) and orientation, then start adding elements. Every document is stored locally. The editor saves shortly after changes, and `Ctrl+S` forces an immediate save.

Documents can be renamed, duplicated, deleted, searched, filtered, and sorted from the dashboard. **Project file → Export** writes a portable `.paperforge.json` containing the document and its imported PDF assets; importing that file regenerates all IDs so it cannot overwrite an existing document.

### Importing PDFs

The import dialog accepts a PDF up to 120 MB, reports corrupt or password-protected files, and records the page count. Imported pages retain a reference to the original PDF asset. Page rotation is composed from the source `/Rotate` and the editor's rotation offset.

Imported pages are rendered with PDF.js for editing and copied into exports as vector pages. The original text is not converted into reflowable blocks — use text overlays, signatures, highlights, or annotations instead.

### Editing

Select an element and use the contextual properties panel for position, size, rotation, opacity, typography, colours, image fitting, table structure, layer order, page settings, and document metadata. Drag on the canvas to move; use the transformer handles to resize or rotate. Hold Shift while selecting for a multi-selection, then align or distribute from the properties panel.

Double-click text (or select it and press `Enter`) to edit inline. `Ctrl+Enter` commits; `Escape` cancels.

### Exporting

The export dialog supports:

- All pages, the current page, or a validated page range.
- **Original size** — each page keeps its imported or editor size. Imported PDF pages are copied as original vector pages, preserving their text and annotations.
- **Place on preset size** — pages are fitted into A4, A5, Letter, or A3 with optional orientation and margin.
- PDF metadata: title, author, subject, keywords, and creator.

Coordinate conversion is handled internally: the editor uses PDF points with a top-left origin, while PDF user space uses a bottom-left origin. Child elements are transformed into page space with affine composition, so rotated, scaled, and nested content lands correctly.

### PDF tools

The tool bench accepts PDFs up to 120 MB and PNG/JPEG images up to 25 MB each. Operations run in the tab with pdf-lib. Results can be downloaded immediately or opened in the editor for a final pass.

| Tool | Notes |
| --- | --- |
| Merge | Two or more PDFs, ordered with the arrow controls. |
| Split | One page per file, fixed chunks, or custom ranges. |
| Rotate | 90°, 180°, or 270° on all or selected pages. |
| Remove pages | Deletes selected pages; at least one must remain. |
| Reorder pages | Requires a complete permutation of page numbers. |
| Images to PDF | PNG/JPEG only, with page size, orientation, margin, and background. |
| Watermark | Text, colour, opacity, rotation, position, and page selection. |
| Page numbers | Six positions, four formats, starting number, size, colour, and margin. |
| Extract pages | Keeps selected pages in ascending order. |

Invalid ranges are rejected before processing. Unsupported image formats (WebP, GIF, SVG, BMP, and so on) produce an explicit message instead of being silently skipped.

### Templates

The template library contains eight fully editable documents built from real elements rather than background images. Templates honour the current theme and can be renamed on creation. Search and category filters make the library quick to scan.

### Settings

Appearance (light, dark, system), default page size and orientation, grid, snap, autosave, reduce motion, browser-storage statistics, clear-library, and preference reset live in Settings. Preferences are kept separately from documents; clearing the library does not reset the interface.

## Keyboard shortcuts

On macOS, use `⌘` wherever `Ctrl` is shown.

| Shortcut | Action |
| --- | --- |
| `V` | Select and move |
| `Enter` | Edit selected text |
| `Double-click` | Edit text on the page |
| `Shift+Click` | Add to selection |
| `Ctrl+A` | Select all elements on the page |
| `Escape` | Clear selection or close a tool |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy, cut, paste |
| `Ctrl+D` | Duplicate selection |
| `Delete` | Delete selection |
| `Ctrl+]` / `Ctrl+[` | Bring forward / send backward |
| `Shift+L` | Lock or unlock selection |
| Arrow keys | Nudge 1 pt (Shift: 10 pt) |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+S` | Save now |
| `Ctrl+Shift+E` | Export PDF |
| `Ctrl+Alt+E` | Export project file |
| `+` / `−` | Zoom in / out |
| `0` / `1` | Fit page / 100% zoom |
| `Space+Drag` | Pan the canvas |
| `Ctrl+Wheel` | Zoom with the mouse |
| `?` | Open the shortcut reference |

## Architecture

```text
src/
  components/    App shell, shared UI, editor, PDF dialogs
  db/            Dexie schema, documents, assets, thumbnails
  hooks/         Shared React hooks
  lib/           Formatting, download, and class utilities
  pages/         Dashboard, Templates, Tools, Settings, Editor, 404
  services/      PDF import, rendering, export, tools, project files
  store/         Zustand preferences, UI, editor, and document stores
  templates/     Eight document builders and instantiation
  types/         Document, page, element, and asset types
  utils/         Geometry, page sizes, validation, colours, files
e2e/             Playwright specs and PDF fixture helpers
public/fonts/    Embedded Inter TTFs used by the export engine
```

The app is a Vite + React 18 + TypeScript SPA. Routing uses React Router. State is split between a preferences store, an editor view store, a UI store, and the document store that owns undo history and autosave. Dexie stores documents and original PDF assets. PDF.js renders imported pages into a cache; pdf-lib performs all PDF writing and tool operations.

See [docs/architecture.md](docs/architecture.md) for the data model, transform pipeline, persistence lifecycle, lazy rendering, and testing strategy.

### Privacy

Paperforge makes no network requests for document data. Fonts are served with the app, files are read with the File API, rendering happens in a worker-backed PDF.js instance, PDFs are generated in the tab, and persistence uses IndexedDB (`paperforge-db`). Browser storage is origin-scoped and can be inspected or cleared from Settings.

## Limits and known behaviour

- PDF files: 120 MB. Images: 25 MB each (PNG/JPEG in PDF tools; WebP/GIF/SVG are accepted for editor images but are normalised to PNG/JPEG before export).
- A document holds up to 500 pages and up to 10,000 elements per page. Undo history is capped at 60 snapshots.
- Imported PDF text is not freely editable; it remains part of the preserved source page. This is deliberate and prevents destructive reflow.
- Very large page counts are lazy-mounted in the editor (a 900 px root margin) and only the first page is used for the document thumbnail.
- Browser storage can be cleared by the browser or private-browsing session. Export a project file for backup.
- The interface is optimised for desktop; narrow screens remain usable but hide the properties panel behind a focus-mode layout.

## Testing

Unit tests cover affine geometry, page-range and page-order parsing, page sizes, validation schemas, all PDF tool operations (including a real PNG embed), template construction and ID regeneration, and file validation.

Playwright covers blank-document creation, inline editing, vector PDF export, imported-PDF preservation, portable project export/re-import with assets, template creation, merge, split, and invalid-range handling. Tests generate their fixtures at runtime with pdf-lib and verify downloaded PDFs with pdf-lib/PDF.js.

```bash
npm test
npm run test:e2e
```

## License

This project is provided as a local-first application sample. Add a license appropriate to your distribution before publishing.
