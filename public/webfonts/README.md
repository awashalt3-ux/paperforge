# Webfonts

The interface fonts are self-hosted here so Paperforge makes **no runtime request** to a font CDN
and works fully offline.

| Family | Files | License |
| --- | --- | --- |
| [Inter](https://rsms.me/inter/) | `inter-*.woff2` | SIL Open Font License 1.1 |
| [Newsreader](https://fonts.google.com/specimen/Newsreader) | `newsreader-*.woff2` | SIL Open Font License 1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | `jetbrains-mono-*.woff2` | SIL Open Font License 1.1 |

Each family is split into `latin` and `latin-ext` subsets. The `@font-face` declarations
(including `unicode-range`) live in [`src/styles/fonts.css`](../../src/styles/fonts.css) and were
generated from the metadata in [`fonts.json`](fonts.json).

These files are for the **interface only**. The PDF export engine embeds a separate set of Inter
TTFs from [`public/fonts/`](../fonts/), which are subset and embedded into generated documents.

## Refreshing the files

1. Request the CSS for the needed weights with a modern browser user agent, for example
   `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`.
2. Download the `latin` and `latin-ext` `woff2` URLs from that CSS.
3. Name each file `<family>-<weight>-<style>-<subset>.woff2`.
4. Regenerate `src/styles/fonts.css` from the metadata, keeping the same `unicode-range` values.

Do not link a stylesheet from `fonts.googleapis.com` in `index.html`; that would break the offline
guarantee and leak a request.
