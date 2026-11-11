# Paperforge

A local-first, open-source PDF studio for designing, editing, and processing documents in the browser. Paperforge combines a Canva-style canvas editor with practical Acrobat-style PDF tools: create a document from scratch, import an existing PDF, edit a template, or run one of nine file operations — all without uploading a byte.

![Paperforge](public/favicon.svg)

**Live demo:** https://paperforge.wasmer.app/

> **Project status:** a complete, self-hostable studio. MIT licensed. See [CHANGELOG.md](CHANGELOG.md) for the latest work and [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

## Why Paperforge

- **Nothing leaves the device.** No server, no account, no telemetry. Documents and imported PDFs live in IndexedDB; PDF reading, rendering, editing, and writing happen in the tab.
- **Real vectors, real text.** Export draws glyphs with embedded Inter fonts instead of flattening to images. Imported pages keep their original vectors, fonts, and annotations.
- **A studio, not a demo.** Undo history, autosave, trash recovery, multi-select alignment, snap guides, templates, and a command palette are all present.
- **Open and auditable.** The whole app is a Vite + React + TypeScript project you can read, fork, and self-host.

## Highlights

### Editor

- Konva canvas with page thumbnails, add/duplicate/rotate/reorder/delete pages, undo/redo (60 snapshots), zoom and pan, snap-to-grid, alignment guides, marquee and multi-select, layer ordering, locking, inline text editing, copy/cut/paste/duplicate, and keyboard shortcuts.
- Real elements: headings, paragraphs, notes, images, logos, tables, rectangles, ellipses, lines, highlights, and hand-drawn signatures.
- Contextual tips in the properties panel, plus a full help centre and shortcut reference.

### PDF import and export

- **Import** — PDF.js validates and renders the source while the original pages are preserved. Imported text is treated as fixed source content; add new text, images, signatures, highlights, and annotations on top.
- **Export PDF** — pdf-lib draws vector text with embedded Inter fonts (via fontkit), images, shapes, tables, and overlays. Imported pages can be copied at original size or fitted onto a preset page size with correct rotation and margin handling. Metadata, page ranges, and progress are included.
- **Export images** — render any page to PNG or JPEG at 72–288 dpi, with optional ZIP bundling.
- **Print** — send the rendered document to the system print dialog with `Ctrl+P`.
- **Project files** — portable `.paperforge.json` backups that include imported PDF assets.

### Templates and tools

- **Eight editable templates** — invoice, professional quotation, resume/CV, business letter, project proposal, meeting report, certificate, and contract. Everything is built from real elements, not background images.
- **Nine PDF tools** — merge, split, rotate, remove pages, reorder, images to PDF, watermark, page numbers, and extract pages. Each is deep-linkable (`/tools?tool=split`) and results can be downloaded individually, as a ZIP, or opened in the editor.

### Workspace

- **Search that works** — `Ctrl/Cmd+K` opens a command palette covering recent documents, destinations, PDF tools, help, and create/import actions, with full keyboard navigation.
- **Trash with recovery** — deleted documents rest in the trash for 30 days. Restore them, delete permanently, or empty the trash; expired items are purged automatically on startup.
- **Local-first persistence** — Dexie/IndexedDB autosave every 500 ms, document thumbnails, restore-on-open, storage statistics, and reset controls.
- **Onboarding and help** — an opt-in welcome tour, a searchable `/help` guide, contextual tips, and a quick-help dialog from the sidebar.
- **A 404 that helps** — unknown routes render a styled recovery page with document search, recent documents, destination cards, and create/import shortcuts.
- **Considered interface** — warm paper palette, forge-green accents, Inter/Newsreader/JetBrains Mono typography (self-hosted), light/dark/system themes, reduced-motion support, and desktop-first responsive layouts.
- **Installable** — a web app manifest makes Paperforge installable as a standalone app.

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

Create a blank document from the sidebar or dashboard, choose a preset (A4, A5, US Letter, A3, or custom millimetres) and orientation, then start adding elements. Every document is stored locally. The editor saves shortly after changes, and `Ctrl+S` forces an immediate save.

Documents can be renamed, duplicated, searched, filtered, sorted, and moved to the trash from the dashboard. **Project file → Export** writes a portable `.paperforge.json` containing the document and its imported PDF assets; importing that file regenerates all IDs so it cannot overwrite an existing document.

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

Additional delivery options:

- **Export images** renders each page to PNG or JPEG (72–288 dpi) and can bundle the results as a ZIP.
- **Print** (`Ctrl+P`) renders the document and opens the system print dialog.
- **Project file** (`Ctrl+Alt+E`) saves a portable backup.

Coordinate conversion is handled internally: the editor uses PDF points with a top-left origin, while PDF user space uses a bottom-left origin. Child elements are transformed into page space with affine composition, so rotated, scaled, and nested content lands correctly.

### PDF tools

The tool bench accepts PDFs up to 120 MB and PNG/JPEG images up to 25 MB each. Operations run in the tab with pdf-lib. Results can be downloaded immediately, downloaded as a ZIP, or opened in the editor for a final pass.

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

### Help and onboarding

- **Quick help** lives in the sidebar footer and covers the three core workflows.
- **The help centre** at `/help` has a searchable guide, a complete shortcut reference, tips, and troubleshooting notes.
- **Contextual tips** appear in the dashboard, properties panel, and tool bench; dismissals persist locally.
- **The welcome tour** is opt-in and can be replayed from Settings.

### Settings

Appearance (light, dark, system), default page size and orientation, grid, snap, autosave, reduce motion, browser-storage statistics, trash management, clear-library, and preference reset live in Settings. Preferences are kept separately from documents; clearing the library does not reset the interface.

## Keyboard shortcuts

On macOS, use `⌘` wherever `Ctrl` is shown. The in-app reference at `/help` and the `?` dialog are generated from the same registry as the handler, so they never drift.

| Shortcut | Action |
| --- | --- |
| `V` | Select and move |
| `T` / `H` / `N` | Add text / heading / note |
| `I` / `R` / `O` / `L` | Add image / rectangle / ellipse / line |
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
| `Ctrl+P` | Print |
| `+` / `−` | Zoom in / out |
| `0` / `1` | Fit page / 100% zoom |
| `PageUp` / `PageDown` | Previous / next page |
| `Space+Drag` | Pan the canvas |
| `Ctrl+Wheel` | Zoom with the mouse |
| `?` | Open the shortcut reference |
| `Ctrl+K` | Command palette |
| `G` then `D/T/P/H/S` | Dashboard, templates, tools, help, settings |

## Architecture

```text
src/
  components/    App shell, shared UI, editor, PDF dialogs, help, onboarding
  db/            Dexie schema, documents, assets, trash
  hooks/         Shared React hooks
  lib/           Formatting, download, zip, shortcuts, tips, navigation
  pages/         Dashboard, Templates, Tools, Help, Settings, Editor, 404
  services/      PDF import, rendering, export, print, image export, tools, projects
  store/         Zustand preferences, UI, editor, and document stores
  templates/     Eight document builders and instantiation
  types/         Document, page, element, and asset types
  utils/         Geometry, page sizes, validation, colours, files
e2e/             Playwright specs and PDF fixture helpers
public/fonts/    Embedded Inter TTFs used by the export engine
public/webfonts/ Self-hosted interface fonts (no CDN requests)
```

The app is a Vite + React 18 + TypeScript SPA. Routing uses React Router. State is split between a preferences store, an editor view store, a UI store, and the document store that owns undo history and autosave. Dexie stores documents and original PDF assets. PDF.js renders imported pages into a cache; pdf-lib performs all PDF writing and tool operations.

See [docs/architecture.md](docs/architecture.md) for the data model, transform pipeline, persistence lifecycle, lazy rendering, and testing strategy.

### Privacy

Paperforge makes no network requests for document data. Fonts and workers are served with the app, files are read with the File API, rendering happens in a worker-backed PDF.js instance, PDFs are generated in the tab, and persistence uses IndexedDB (`paperforge-db`). Browser storage is origin-scoped and can be inspected or cleared from Settings.

## Limits and known behaviour

- PDF files: 120 MB. Images: 25 MB each (PNG/JPEG in PDF tools; WebP/GIF/SVG are accepted for editor images but are normalised to PNG/JPEG before export).
- A document holds up to 500 pages and up to 10,000 elements per page. Undo history is capped at 60 snapshots.
- The trash keeps deleted documents for 30 days. Document assets are retained until the document is purged.
- Imported PDF text is not freely editable; it remains part of the preserved source page. This is deliberate and prevents destructive reflow.
- Very large page counts are lazy-mounted in the editor (a 900 px root margin) and only the first page is used for the document thumbnail.
- Browser storage can be cleared by the browser or private-browsing session. Export a project file for backup.
- The interface is optimised for desktop; narrow screens remain usable but hide the properties panel behind a focus-mode layout.

## Testing

Unit tests cover affine geometry, page-range and page-order parsing, page sizes, validation schemas, all PDF tool operations (including a real PNG embed), template construction and ID regeneration, file validation, ZIP packaging, and the shortcut and tips registries.

Playwright covers blank-document creation, inline editing, vector PDF export, imported-PDF preservation, portable project export/re-import with assets, template creation, merge, split, invalid-range handling, image export, trash recovery, the help centre, and the welcome tour. Tests generate their fixtures at runtime with pdf-lib and verify downloaded PDFs with pdf-lib/PDF.js.

```bash
npm test
npm run test:e2e
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the house rules and the extension points, and [SECURITY.md](SECURITY.md) before reporting a vulnerability. This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Paperforge contributors.
