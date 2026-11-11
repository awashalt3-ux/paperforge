# Changelog

All notable changes to Paperforge are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

## [Unreleased]

### Added

- **Help centre** at `/help` with a searchable guide, a complete shortcut reference, tips, and
  troubleshooting notes. Reachable with `G H` or from the command palette.
- **First-run onboarding tour** that introduces the three ways to start a document. It can be
  replayed from Settings.
- **Contextual tips** in the dashboard, editor properties panel, and tool bench. Dismissals persist
  locally.
- **Trash with recovery.** Deleting a document now moves it to the trash for 30 days. Documents can
  be restored, deleted permanently, or purged from the dashboard and Settings. Expired items are
  cleaned up on startup.
- **Export images (PNG / JPEG).** Each page is rendered through the PDF engine and rasterized at
  72–288 dpi, with optional ZIP bundling.
- **Print** from the editor (`Ctrl+P`). Pages are rendered and sent to the system print dialog.
- **ZIP download** for multi-file results on the PDF tool bench, instead of N separate downloads.
- **PWA manifest** and self-hosted interface fonts, so the app works fully offline.

### Changed

- Documents in the trash are excluded from the dashboard, palette, and recent list.
- Settings reports trashed documents separately and can empty the trash on its own.
- Shortcut documentation now comes from a single registry shared by the dialog, help page, and the
  command palette.
- The command palette also surfaces the help guide and the shortcuts panel.

### Fixed

- Deleting a document no longer destroys its imported PDF assets before the trash window expires.
- Duplicated documents no longer inherit the trash state or a stale thumbnail.

## [1.0.0]

Initial public version: editor, eight templates, nine PDF tools, portable projects, local-first
persistence, command palette, and a styled 404.
