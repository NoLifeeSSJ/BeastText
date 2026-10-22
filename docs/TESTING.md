# Verification evidence

Validation was performed on **22 October 2026, Linux x64**, Node 24.19.0 and Electron 45.0.0. The requested Windows filesystem path is represented by `/workspace/BeastText` in this machine. This report distinguishes executed checks from the remaining Windows release gate.

## Executed

- TypeScript check, Vite renderer build, bundled Electron main/preload: passed.
- Unit/integration suite: **15 tests passed**, no skips/expected failures. Native round-trip, built-in templates, ZIP safety/unsupported versions/checksums, unsafe content, Unicode counts, atomic writes/failure preservation, external fingerprints, untitled recovery, backup retention, DOCX/Markdown conversion and embedded line breaks.
- Electron user journeys: **7 tests passed**, no skips/expected failures. Actual application processes and IPC/file operations; native file chooser decisions and spelling-menu presentation are stubbed; spelling results still come from Chromium.
  1. Create/format, heading, table typing/Tab navigation, image, page break, find/replace, undo/redo, native save, close and reopen with rich content preserved.
  2. Anchored comment creation, native save, external modification, refused overwrite, cancelled close.
  3. Actual PDF and DOCX export; generated PDF opens in print-preview window.
  4. Untitled recovery snapshot, process killed unexpectedly, fresh process discovers and recovers content.
  5. Untrusted HTML script/link/remote-image sanitisation, cancelled Save, original file preservation and independent tab history.
  6. Comment anchors and resolved state survive native reopen; Save a Copy preserves the active destination.
  7. Bundled offline English dictionary initialises and supplies the correction “spelling” for “speling” through the native context-menu pipeline.
- Production dependency audit: **0 known vulnerabilities** at check time. The discovered fflate 0.8.2 ZIP64 advisory was fixed by pinning 0.8.3 before the final build.
- PowerShell parser validation of installer, uninstaller and Windows acceptance script: **0 parse errors**, using checksum-verified PowerShell 7.5.4. This is syntax validation, not execution of Windows integration.
- Windows x64 ZIP cross-build: generated with Electron-builder. BeastText EXE icon/version resource editing is enabled; code signing is disabled. Release SHA-256/size metadata is generated and checked separately. No Windows execution is implied by cross-building.
- Sample generation: short letter, report with embedded image, several tables, Unicode and unusual filename, and synthetic 50,000-word document.
- Output verification script: PDF, DOCX and HTML generated from a combined report/image/tables/page-break fixture. The resulting DOCX is imported into the real editor and confirmed to contain tables and an image; screenshot retained. Chromium's print CSS path is separately rendered to PDF, including repeating headers/footers and actual page counters.
- Visual checks: start screen and rich editor inspected. A4 PDF pages inspected with rasterisation; selectable text extracted with `pdftotext`. The basic report has 2 pages; combined rich fixture has 4 pages, with header/footer occurrence counts matching its page count. Physical printing is unrun.

Evidence: `docs/verification/` includes editor/import screenshots, the rich DOCX/HTML/PDF and a separate PDF generated using direct-print CSS rules. `PERFORMANCE.json` and `DESKTOP_PERFORMANCE.json` contain raw measurements. Timings and synthetic content limitations are stated in those files; memory fields returned by Electron are KiB.

## Reproduce

```sh
npm run build
npm test
DISPLAY=:99 npm run test:e2e
npm run samples
DISPLAY=:99 npm run benchmark
DISPLAY=:99 node scripts/verify-output.mjs
npm run package:win
```

Use an existing display or Xvfb on other Linux systems. `scripts/cloud-display.sh` starts this machine's available Xorg dummy driver if needed. Tests use temporary profiles and no real user documents. Source/dependency/build changes require rerunning affected tests; formatting-only evidence changes do not.

## Windows acceptance — not executed here

The provided GitHub Actions Windows workflow and `scripts/verify-windows.ps1` have not run in this session. Before certifying the release:

- Execute the local installer on supported x64 Windows 10/11, with spaces/apostrophes in the root.
- Launch the installed application from the Start menu/desktop shortcut and open a launch-path document; test a second launch routing files to the existing instance.
- Repeat core document workflows in the packaged application, including drag/drop, native picker cancellation, clipboard images/plain paste, high DPI, keyboard-only dialogs and Windows IME composition.
- Install again and confirm preservation of documents/settings/recovery; force an update failure and confirm rollback.
- Run uninstall and confirm only app files/owned shortcuts/owned association entries are removed; separately test the explicit RemoveUserData option.
- Inspect representative DOCX in an independent viewer and print the PDF/print path to physical hardware if physical printing is to be certified.

Known scope/feature limitations remain in KNOWN_LIMITATIONS.md. Windows execution, signing and online publication were not invented or reported as completed.
