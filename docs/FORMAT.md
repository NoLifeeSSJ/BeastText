# BeastText native format, version 1

Extension: `.beasttext`. Container: ZIP (DEFLATE). File names and entry kinds are fixed:

```
manifest.json
 document.json
assets/<uuid>
```

(The space above is indentation only; the entry is exactly `document.json`.)

`manifest.json` has `format: "BeastText"`, `version: 1`, and `assets` keyed by UUID. Each asset declares MIME, byte size and SHA-256. `document.json` contains the structured document with an empty `assets` record; decoding reconstitutes embedded base64 assets into the in-memory canonical model. Image `src` values are `beast-asset:<uuid>`, never file paths or web URLs.

The canonical schema is defined in `src/shared/model.ts`:

- `format`, `version`, UUID `id`, title, ISO created/modified timestamps.
- `content`: ProseMirror JSON document containing paragraphs, text, headings 1–3, lists, blockquote, code block, horizontal rule, line/page breaks, inline-placement block images, tables and table-of-contents node.
- `styles`: named paragraph definitions (font, size, colour, line height and spacing); blocks reference names with `styleName`. Character formatting is stored as marks; reusable custom character-style definitions are not implemented.
- `page`: A4/Letter, orientation, four millimetre margins, header/footer text, generated page-number preference. `differentFirstPage` is reserved for DOCX section conversion; the UI does not offer it because PDF support is incomplete.
- `assets`: UUID → MIME plus base64 image bytes in memory; bytes stored separately in ZIP.
- `comments`: UUID, text, author, timestamp, resolved flag. Text marks reference comment IDs; ProseMirror maps those marks through edits.
- `metadata`: author and description. `goal`: optional word-count target.

## Validation and limits

Maximum compressed file: 64 MiB. Maximum expanded file: 32 MiB per entry, 100 MiB total, 1000 entries. Maximum content nesting: 64 levels, 300,000 nodes. Base64 asset total is bounded (about 60 MB binary); file-based image insertion allows 25 MB before optional downsampling. Unknown node/mark/attribute kinds, unsafe hyperlinks, non-embedded images and missing assets fail validation. Checksums catch corrupt assets. ZIP paths are never extracted into the user file system.

Read errors identify the problem and preserve the source. Read-only, permission, locked-file and disk-space failures propagate as visible operation errors. Temporary files are removed after failed writes; existing files are not intentionally truncated in place. Backups are required to succeed before overwriting an existing native document when retention is enabled.

## Migration policy

Only version 1 is accepted today. Unknown/newer versions are rejected with a clear message; they are never silently reinterpreted or downgraded. A later format must add pure, tested `vN → vN+1` transformations before changing the writer version. Keep the original input on every migration/parse failure. There is no historical v0 format and therefore no fabricated migration path to test in this release.

Round-trip tests cover structural content, styles, comments, page settings, Unicode and image bytes. Unsupported/malformed version tests cover the current migration boundary.
