# Verification evidence

Local validation was performed on **22 October 2026, Linux x64**, Node 24.19.0 and Electron 45.0.0. GitHub Actions then ran the build, 17 unit tests, all 7 Electron user journeys and Windows packaging on **22–23 October 2026, Windows x64**. The requested Windows filesystem path is represented by `/workspace/BeastText` on the Linux machine.

## Updater and cumulative history

Version 1.1.1 adds PowerShell parser checks for the updater and an offline CheckOnly exercise. Windows release acceptance checks anonymous online release discovery/history preview, reinstalls using the packaged offline updater with a root containing spaces/apostrophes, compares the entire installed changelog to the source history, and checks document/user-data preservation and uninstallation. The app code is unchanged from 1.1.0; the release workflow still runs the 18 unit and nine desktop checks before publication.

## Updated file and appearance checks

For 1.1.0, local Linux validation on 24 October 2026 passed the TypeScript/production build, **18 unit/integration tests** and **9 Electron desktop journeys**. The tag's Windows workflow gates publication on those same checks plus package creation and installer acceptance; its final result is authoritative for Windows release readiness.

New coverage saves real DOCX/TXT/HTML/Markdown files through File → Save as, checks their contents, edits and saves again to each destination, cancels a new destination, and refuses external overwrites even when the conflicted file is reselected. A backup test checks original non-native bytes/extensions. Theme coverage clicks the visible control, restarts the application, verifies persistence, uses File/Escape without losing content, and changes emulated system appearance live. Only native chooser decisions and OS popup presentation are stubbed.

Screenshots of the updated File screen are in verification/file-save-as-dark.png and verification/file-menu-light.png. Paper retains print colours in dark mode.

## Original V1 evidence

- TypeScript check, Vite renderer build, bundled Electron main/preload: passed.
- Unit/integration suite: **17 tests passed**, no skips/expected failures. Native round-trip, built-in templates, ZIP safety/unsupported versions/checksums, unsafe content, Unicode counts, atomic writes/failure preservation, external fingerprints, untitled recovery, backup retention, DOCX/Markdown conversion embedded line breaks, local US/UK spelling and persistent personal dictionary additions.
- Electron user journeys: **7 tests passed on Linux and Windows**, no skips/expected failures. Actual application processes and IPC/file operations; native file chooser decisions and spelling-menu presentation are stubbed; spelling results come from the bundled offline dictionaries and application menu actions.
  1. Create/format, heading, table typing/Tab navigation, image, page break, find/replace, undo/redo, native save, close and reopen with rich content preserved.
  2. Anchored comment creation, native save, external modification, refused overwrite, cancelled close.
  3. Actual PDF and DOCX export; generated PDF opens in print-preview window.
  4. Untitled recovery snapshot, process killed unexpectedly, fresh process discovers and recovers content.
  5. Untrusted HTML script/link/remote-image sanitisation, cancelled Save, original file preservation and independent tab history.
  6. Comment anchors and resolved state survive native reopen; Save a Copy preserves the active destination.
  7. Bundled offline English checking initialises and supplies the correction “spelling” for “speling” through the application context menu; choosing it replaces the word in the real editor.
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

## Windows automation and remaining manual acceptance

The GitHub Actions workflow gates tagged publication on build, unit tests, Electron user journeys, native Windows packaging, and `scripts/verify-windows.ps1`. That script installs to a root containing spaces/apostrophes, inspects the real Start menu target, reinstalls while checking preservation of documents/user data, and uninstalls while checking removal of the app and owned shortcuts. It uses Windows PowerShell 5.1 for installation/reinstallation. Failed checks prevent release publication; installer errors are retained as workflow annotations.

The passing Windows desktop run for the application code is [39874645140](https://github.com/NoLifeeSSJ/BeastText/actions/runs/39874645140); its original installer assertion exposed an 8.3-path discrepancy which the subsequent patch corrects. The corrected installer checks passed in [39875833022](https://github.com/NoLifeeSSJ/BeastText/actions/runs/39875833022). The release's tag run is the authoritative result for its complete publication gate.

Before certifying full manual Windows acceptance:

- Exercise the installer on end-user Windows 10/11 machines and test the optional `.beasttext` association.
- Launch the installed application from the Start menu/desktop shortcut and open a launch-path document; test a second launch routing files to the existing instance.
- Repeat core document workflows in the packaged application, including drag/drop, native picker cancellation, clipboard images/plain paste, high DPI, keyboard-only dialogs and Windows IME composition.
- Force an update failure and confirm rollback; separately test the explicit RemoveUserData option.
- Inspect representative DOCX in an independent viewer and print the PDF/print path to physical hardware if physical printing is to be certified.

Known scope/feature limitations remain in KNOWN_LIMITATIONS.md. The application is unsigned. Automated Windows execution does not certify IME, accessibility, third-party Word fidelity or physical printing.
