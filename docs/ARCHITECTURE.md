# BeastText V1 architecture

BeastText is an offline Electron application. React renders a compact ribbon and document workspace. Tiptap 3 / ProseMirror owns document editing, selection, history and table transactions. It is an established editing engine rather than a home-grown rich-text box.

The original brief names `C:\BeastTextV1`. In this Linux cloud checkout the equivalent project is `/workspace/BeastText`; copying the repository to `C:\BeastTextV1` preserves the documented Windows layout. Neither BeastSnip nor BeastNotes code/assets were present. Colour, spacing and typography tokens live in `src/renderer/style.css`; document style defaults live in `src/shared/model.ts`.

## Boundaries

- `src/main`: native dialogs, bounded file reads, atomic writes, backups/recovery, local dictionaries, PDF/printing, conversion, session/settings, Windows launch handling.
- `src/preload`: narrow, typed context bridge. No renderer Node access; IPC requests must originate in the main frame of the app window.
- `src/renderer`: editor extensions and user interface. All imports/pasted HTML pass through DOMPurify and a second URL/style/image filter. Remote images are removed, not fetched.
- `src/shared`: canonical document schema, templates, statistics, safe HTML generation and bridge contracts.
- `resources`: identity and bundled US/UK English spelling dictionaries and their upstream licences.
- `tests`: native safety, file failure/recovery, conversion and actual Electron user journeys.
- `scripts`: builds, sample generation, measurements, release metadata and licence inventory.
- `release`: generated Windows archive, checksum metadata and installer scripts (ignored in Git).
- `samples`: editable sample native documents, including 50,000 words.
- `docs`: design, native format, compatibility, limitations and verification evidence.

The editable ProseMirror JSON tree is the only content representation. HTML, Markdown, plain text, OOXML and PDF are derived outputs, never parallel live document stores. Assets are addressed by UUID from image nodes. One mounted editor per tab retains independent history while switching documents. Metadata/style/page changes persist with the document; these are outside ProseMirror history.

## Editor capability decision

The installed MIT-licensed Tiptap packages provide semantic headings, nested lists, link marks, image nodes, history and ProseMirror tables with resizing, cell selections, row/column commands, merge/split and cell Tab navigation. Custom extensions add paragraph style references, spacing/indent attributes, stable heading IDs, explicit page breaks and persistent comment marks. Image width/height are stored together for proportional resizing. Comments without remaining anchored text are retained and identified when selected; overlapping comment ranges are outside the supported subset.

Ordinary typing is grouped by ProseMirror history; replace-all and case conversion explicitly close history groups. Tables/images remain ordinary document transactions. No premium Tiptap extension, external API, Word automation or account is needed.

## Pagination decision

The editable surface is a continuous document whose width/margins match the selected paper. It never presents decorative repeated pages as real pagination. Explicit page breaks are content nodes. Chromium's print engine calculates real pages using `@page`, and exports selectable-text PDF with real page-number fields. Preview opens that generated PDF in a separate application window. The editor therefore shows no fabricated page count. Layout can vary with installed fonts; neither browser-based editing nor DOCX conversion promises Word-identical line wrapping.

## Security and persistence

Renderer isolation and sandboxing are enabled. CSP restricts scripts to local bundles and images to local/data resources. Imported links allow http(s), mailto and heading anchors; external links require user action. DOCX external file access is disabled. ZIP expansion is bounded before decompression, unsafe native entry names are rejected and assets have SHA-256 integrity checks. The original file is never modified on import or parse failure.

Native writes use a same-directory exclusive temporary file, file flush, close and rename. A content hash detects changes since open/save. A conflict offers Save As or cancel. Backups contain previous native files, separately from periodic recovery snapshots and user documents. Diagnostics record operation/error categories, never document text or full process environments.

A small loopback server serves only the two bundled `.bdic` filenames to Electron's spellchecker; it does not expose documents or file-system paths and requires no Internet connection. Personal dictionary entries use Electron's persistent dictionary API.

## Dependencies and sources checked

Package versions and licences were checked against npm metadata on 22 October 2026, then pinned in `package-lock.json`. `docs/THIRD_PARTY.json` lists the installed dependency inventory; original licences ship with the runtime/dependencies. MIT: Electron, Tiptap, docx, fflate, React; BSD-2-Clause: Mammoth; DOMPurify is dual Apache-2.0/MPL-2.0. Development tooling has its own licence notices.

Authoritative documentation consulted:

- Tiptap table package README: https://github.com/ueberdosis/tiptap/tree/main/packages/extension-table
- Installed Tiptap extension type declarations for exact commands/options.
- Electron session API (local dictionaries): https://github.com/electron/electron/blob/main/docs/api/session.md
- Electron webContents API (printToPDF/print): https://github.com/electron/electron/blob/main/docs/api/web-contents.md
- Mammoth security and conversion contract: https://github.com/mwilliamson/mammoth.js#security
- Dictionary origin/checksum: `resources/dictionaries/SOURCE.json`; upstream notices are retained alongside the dictionaries.

The documentation websites for Tiptap and Electron were blocked by the environment's network policy, so their official GitHub sources and installed declarations were used. No TLS, signature or checksum checks were disabled.
