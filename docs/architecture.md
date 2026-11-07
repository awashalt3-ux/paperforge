# Architecture

This document describes how Paperforge is put together: the document model, coordinate conventions, persistence, rendering, PDF import/export, and testing. It is intended for contributors who need to change behaviour without breaking fidelity.

## Application shape

Paperforge is a client-only React 18 single-page application built with Vite and TypeScript. There is no server component. Routes are:

- `/` — dashboard with search, filter, sort, document actions, and template shortcuts.
- `/templates` — searchable/category-filtered template library.
- `/tools` — the nine PDF operations.
- `/settings` — preferences, storage statistics, and maintenance.
- `/editor/:id` — the full-screen editor (outside `AppShell`).
- `*` — not-found page.

Global dialogs (create document, import PDF) are mounted once in `App.tsx` and controlled by `uiStore`, so they are available from every route that uses the shell.

## State

State is intentionally split by lifetime:

| Store | Responsibility | Persistence |
| --- | --- | --- |
| `preferencesStore` | Theme, default page size/orientation, grid, snap, autosave, reduced motion | Zustand `persist` to localStorage |
| `uiStore` | Dialog visibility, sidebar state, focus mode | In-memory |
| `editorStore` | Active page, selection, tool, zoom, pan, pending edit requests | Zustand `persist` for view state |
| `documentStore` | Active document, undo/redo history, save status, thumbnail updates | Dexie + debounced autosave |

`documentStore` is the single writer for document content. Mutations go through `updateActive`, which clones the document, records a history snapshot, marks the document dirty, and schedules an autosave. History entries are coalesced by `historyKey`, so dragging an element or typing in a text field produces one meaningful undo step instead of one per pointer event. History is capped at 60 snapshots.

Autosave checks `preferencesStore.getState().autosave`. When autosave is disabled, edits remain `unsaved` until `saveNow` is called (`Ctrl+S`, leaving the editor, or an explicit save action). Thumbnail writes bypass `updatedAt` so capturing a preview does not create an infinite save loop.

## Data model

The canonical types live in `src/types/document.ts`.

```text
PaperDocument
  id, title, createdAt, updatedAt, templateId?, thumbnail?
  metadata: { title, author, subject, keywords[], creator }
  pages: PaperPage[]

PaperPage
  id, width, height, background, elements[]
  source?: { assetId, pageIndex, rotationOffset?, originalName? }

PaperElement
  common: id, x, y, width, height, rotation, opacity, locked, visible, name?
  text: text, role, fontFamily, fontSize, fontWeight, italic, underline,
        color, align, lineHeight, letterSpacing, backgroundColor?, padding
  image: role (image|logo|signature), src (data URL), fit, cornerRadius, alt?
  shape: shape (rectangle|ellipse|line), purpose (shape|highlight),
         fill, stroke, strokeWidth, cornerRadius, dash?
  table: rows[][], headerRow, fontFamily, fontSize, color, headerColor,
         headerBackground, borderColor, borderWidth, cellPadding,
         rowHeights?, columnWeights?
```

`PaperPage.width` and `.height` are always the **visual** dimensions after source rotation. For imported pages, the original asset remains untouched in Dexie and is referenced by `source.assetId` and `source.pageIndex`.

Zod schemas in `src/utils/validation.ts` validate documents, pages, elements, assets, and portable project files. They are used for project imports and defensive checks.

## Coordinate systems

Three spaces meet in the editor and exporter:

1. **Editor / page-local** — PDF points, origin at the page's top-left, y increasing downward. Element `x`/`y` refer to the top-left corner before rotation.
2. **Visual page / canvas** — same orientation as the editor, origin top-left. Rotation of a page's source is folded into the page dimensions and the mapping to user space.
3. **PDF user space** — PDF points, origin bottom-left, y increasing upward. This is what pdf-lib and the PDF format use.

`src/utils/pdfGeometry.ts` provides the affine helpers:

- `multiplyAffine(outer, inner)` composes transforms with the inner transform applied first.
- `invertAffine` inverts a non-singular transform.
- `getVisualPageGeometry(rotation, cropBox)` returns visual width/height and the `visualToUser` matrix for 0/90/180/270 degrees, including a non-zero crop-box origin.
- `elementLocalToVisual(element, pageHeight)` converts an element's local bottom-left space into visual page space. The formula accounts for CSS clockwise rotation, which is the opposite sign of PDF's counter-clockwise rotation.

The exporter builds `visualToTarget * elementLocalToVisual(element, page.height)` for every element. Draw calls therefore receive local element coordinates; the graphics state carries the transform.

Imported pages add `rotationOffset` on top of the source page's `/Rotate`. Rotating a page in the editor increments the offset; the displayed dimensions swap accordingly. The original PDF page is never rewritten.

## Persistence

`src/db/database.ts` defines Dexie tables:

- `documents` — validated `PaperDocument` records.
- `assets` — original PDF bytes plus name, MIME type, page count, and timestamps.

Imported PDF assets are stored as `Uint8Array`/`ArrayBuffer` data and never re-encoded. Project export serialises the active document and referenced assets to a versioned JSON file (`format: "paperforge-project"`, `version: 1`) with base64 asset payloads. Import validates the file, regenerates document/page/element/asset IDs, and remaps `source.assetId` references. This prevents an imported project from overwriting an existing document or sharing mutable assets.

## PDF rendering

`src/services/pdfRenderer.ts` loads PDF.js, configures a worker, and keeps a small render cache keyed by asset/page/scale/rotation. Imported page rendering uses `(page.rotate + rotationOffset)` and swaps dimensions for 90°/270°.

The editor mounts one Konva `Stage` per page. Each stage's scale equals the current zoom, so page-local units remain PDF points. Page components are lazy-mounted with an `IntersectionObserver` (`root` = scroll container, `rootMargin: 900px`). The first page stays mounted so thumbnails can be captured; the active page and any page being edited are mounted immediately. Editing pages cannot unmount while the inline textarea is open.

Element nodes are wrapped in Konva `Group`s with full-size transparent hit rectangles. Text, table, and image content are clipped to their frames. Inline text editing is an absolutely positioned HTML `textarea` over the canvas, sized and rotated with the element.

## PDF import

`src/services/pdfImporter.ts` performs validation before touching the database:

1. Size limit (120 MB) and empty-file check.
2. `%PDF-` header check.
3. PDF.js open attempt; encrypted or corrupt documents produce actionable errors.
4. Page count and per-page dimensions/rotations are read.
5. The source asset is preserved and the document is created with one page per source page, each carrying a `source` reference.

Unsupported or damaged files are reported in the import dialog and nothing is written to IndexedDB.

## PDF export

`src/services/pdfExport.ts` is the writing engine. It supports:

- **Original size** — source pages are copied with `copyPages` into the output document, preserving vectors, fonts, annotations, and page boxes. Editor overlays are appended on top. New pages are created at their editor dimensions.
- **Preset size** — source pages are embedded as form XObjects with `embedPage` using the crop-box bounding box. The source `/Rotate` is explicitly applied with `drawPage` because form XObjects do not inherit page rotation. The embedded page is fitted inside the target page minus the margin, and its background is painted first.
- **Editor pages** — text is drawn as vector glyphs with `drawText`, using wrapped lines, alignment, letter spacing, underline, and baseline adjustment (`0.8 × fontSize`). Images are embedded from data URLs. Shapes, highlights, and tables are drawn with pdf-lib operators and graphics-state transforms.
- **Fonts** — Inter is fetched from `public/fonts` and embedded/subset through fontkit. If Inter cannot load, the resolver falls back to the matching standard PDF font, with text sanitised for WinAnsi. `@pdf-lib/fontkit`'s ES bundle exports a default object while its type declarations describe named exports, so the service normalises both shapes before calling `registerFontkit`.
- **Metadata** — title, author, subject, keywords, creator, and producer are written to the output document.
- **Page selection** — `pageIndices` is resolved by `parsePageRanges` in the export dialog, validated against the current document.
- **Output** — bytes are wrapped in a typed `Blob` and downloaded through a temporary object URL, with a safe filename.

Progress callbacks report a human-readable label plus current/total page counts. Errors surface in the dialog without leaving a partial download.

## PDF tools

`src/services/pdfTools.ts` contains all nine operations and shared helpers. Each operation:

1. Loads bytes with pdf-lib.
2. Rejects empty/encrypted/corrupt input with `PdfToolError` and a stable code.
3. Validates page ranges or order before mutating.
4. Writes a new document, leaving the source untouched.

Watermarks and page numbers use the same visual-page transforms as export so placement remains correct on rotated and cropped source pages. Images-to-PDF accepts only PNG/JPEG, validates image headers and dimensions, fits the image inside the margin-aware page, and paints the selected background. Results are downloaded as PDFs or imported into the editor through the normal PDF import pipeline.

## Testing

- **Vitest** (`src/**/*.test.ts`) runs in jsdom. It covers affine math, page geometry, size presets, validation schemas, all PDF tool operations, template construction, ID regeneration, and file validation. `src/tests/setup.ts` polyfills `Blob.arrayBuffer` for jsdom.
- **Playwright** (`e2e/*.spec.ts`) runs against a Vite server on port 4173. It creates documents, edits text inline, exports and re-parses PDFs, imports a generated PDF and checks that its vector pages survive export, instantiates templates, and exercises merge/split/range validation. Fixtures are generated at runtime with pdf-lib; downloaded PDFs are inspected with pdf-lib and PDF.js.

The Playwright configuration starts the dev server automatically and reuses an existing server outside CI. Install the Chromium binary once with `npx playwright install chromium`.

## Extension points

- **Add a template** — add a builder and definition to `TEMPLATE_DEFINITIONS` in `src/templates/index.ts`. Every template must return at least one populated page; the unit tests validate all definitions and instantiation.
- **Add an element type** — extend the discriminated union in `src/types/document.ts`, add a Zod schema, add a Konva renderer and hit area in `EditorCanvas.tsx`, add property controls, then teach `pdfExport.ts` how to draw it.
- **Add a PDF tool** — implement the operation in `pdfTools.ts`, add validation, return `{ bytes, pageCount }`/`SplitResult[]`, and wire a tool definition, options panel, and result handling in `ToolsPage.tsx`.
- **Change export sizing** — keep the three-space model intact. New page fitting belongs in the visual-to-target matrix, not in per-element coordinate hacks.
