# Security policy

Paperforge is a client-only application. There is no server, no account, and no upload endpoint, so
the threat model is different from a hosted service.

## Supported versions

Only the current `main` branch is supported. Fixes ship as normal releases.

## What we consider a vulnerability

- A path that sends document content, imported PDFs, or signatures off the device.
- Cross-site scripting through imported file names, document titles, or text content.
- A way for one document or project to read another document's data.
- Denial of service that freezes the tab with a mundane file (for example, an unvalidated page
  count or dimension).
- Any dependency advisory that affects the shipped bundle.

## What we do not consider a vulnerability

- The fact that local IndexedDB is readable by extensions or scripts running on the same origin.
  This is inherent to browser storage; use a private profile or a separate browser profile for
  sensitive work.
- Password-protected PDFs not being supported. They are rejected explicitly.
- Imported PDF text not being reflowable. This is a deliberate design choice.

## Reporting

Please do not open a public issue for a security problem. Send a private report to the maintainers
listed in `package.json`, including:

- a description of the issue and its impact,
- reproduction steps or a proof of concept,
- the browser and version you used.

You can expect an acknowledgement within a few days. Please give us a reasonable window to ship a
fix before disclosing publicly.
