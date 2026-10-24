# BeastText 1.1

An offline desktop document workspace with structured editing, native document storage, recovery and useful conversion. Built with Electron, React and Tiptap / ProseMirror. No Word installation, account, subscription, API key or browser tab required.

**Release status:** An unsigned Windows x64 prerelease, built and checked by GitHub Actions. Desktop workflows are tested on Linux and Windows. Manual Windows IME, high-DPI and physical-printer acceptance remains outstanding. See [test evidence](docs/TESTING.md) and [known limitations](docs/KNOWN_LIMITATIONS.md).

## Install on Windows

Download and run the installer from the [1.1.0 release](https://github.com/NoLifeeSSJ/BeastText/releases/tag/v1.1.0). In PowerShell:

```powershell
$base = 'https://github.com/NoLifeeSSJ/BeastText/releases/download/v1.1.0'
$installer = Join-Path $env:TEMP 'Install-BeastText.ps1'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -UseBasicParsing "$base/Install-BeastText.ps1" -OutFile $installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -ManifestUrl "$base/release.json" -DesktopShortcut -Launch
```

The execution-policy option applies only to that PowerShell process. It does not change machine policy. Organisation-enforced policies still apply. You can inspect the [installer source](Install-BeastText.ps1) first.

For an offline install, download `Install-BeastText.ps1`, `release.json` and the ZIP into the same folder, then run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-BeastText.ps1 -DesktopShortcut -Launch` there. For a source checkout with the archive/metadata in `release\`:

```powershell
cd C:\BeastTextV1
.\Install-BeastText.ps1 -DesktopShortcut -Launch
```

The default installed application is `C:\BeastTextV1\App\BeastText.exe`. Source (`src`), build outputs (`dist`), installed files (`App`) and releases (`release`) remain separate. An x64 Windows 10 22H2/11 system needs no Node.js or other developer tools to run the packaged release. The installer verifies SHA-256/size metadata, stages updates, makes a Start menu shortcut and preserves per-user documents/settings/recovery. Add `-AssociateNative` to register `.beasttext` as an available open command; DOCX/default associations are not taken over.

If the root is not writable, choose a user folder without elevation:

```powershell
.\Install-BeastText.ps1 -Root "$env:LOCALAPPDATA\BeastTextV1" -Launch
```

Paths containing spaces/apostrophes are passed as parameters, not evaluated as code. If your organisation's execution policy blocks unsigned scripts, use its approved signing/execution process; the installer does not modify execution policy. The application is currently unsigned.

Uninstall while preserving documents and user data:

```powershell
.\Uninstall-BeastText.ps1 -Root C:\BeastTextV1
```

`-RemoveUserData` is a separate, explicit request to remove `%APPDATA%\BeastText` settings, recovery, backups and templates. Source and documents remain outside `App`. Source and documentation are stored in Git; built ZIPs and installers are attached to GitHub Releases.

## Write and save

Create a blank document or choose one of twelve editable templates. Home contains text/paragraph formatting; Insert adds images, tables, links, comments, contents and page breaks. Layout controls paper, orientation, margins and headers/footers. Review provides search/replacement and comments. View offers outline, properties, focus and zoom. Click the document title to rename it.

Open **File** for a dedicated document screen with Save, Save as, recent files and Print. **File → Save as** (or **Ctrl+Shift+S**) offers Word `.docx`, plain text `.txt`, HTML, Markdown and BeastText, with a clear description of what each format preserves. Choose a format and location; subsequent **Ctrl+S** saves to that file. Cancellation keeps the current destination. Backups and external-change protection apply to all editable formats. PDF saves a separate paginated copy and keeps the editable document's destination unchanged.

Use `.beasttext` to preserve the complete native feature set, including comments and styles. Imported DOCX/TXT/MD/HTML files still open as new unsaved documents to protect their originals until you explicitly choose a Save as destination. Legacy `.doc`, RTF and ODT are not supported. Accurate pages and generated page fields are shown in **File → Print → Print preview**; editing remains continuous.

Use the **moon/sun button in the title bar** for one-click dark/light mode. **File → App appearance** also offers Light, Dark and System; the choice persists across restarts, and System follows appearance changes while the app is open. Dark mode changes the application interface; the document paper retains its print colours.

Recovery snapshots are separate from saving. Default interval is 30 seconds, configurable in Settings. Recovery includes untitled documents; recovered work opens as a new unsaved copy. Named-file automatic saving is an independent opt-in preference. Recovery/backups/logs can be opened from document properties.

## Develop

Requirements: Node.js 22.12+ (Node 24 tested), npm; Windows for Windows acceptance tests. Linux GUI tests need X11/Xvfb and standard Electron system libraries.

```sh
npm ci
# Electron 45 installs its binary on first use; behind an environment proxy use NODE_USE_ENV_PROXY=1.
npm exec install-electron -- --no
npm run dev
```

```sh
npm run build
npm start
npm test
npm run test:e2e
npm run samples
npm run package:win
```

On a Linux CI host use an existing display or `xvfb-run -a npm run test:e2e`. Do not add `--no-sandbox` to production launch scripts; the isolated Linux test harness uses it only where the container does not support Chromium sandboxing. Tests use a temporary `BEASTTEXT_DATA` directory and never the user's documents/settings. `npm run package:win` writes the ZIP plus `release.json` and installers; it does not publish or sign a release.

More: [architecture](docs/ARCHITECTURE.md), [native format](docs/FORMAT.md), [compatibility](docs/COMPATIBILITY.md), [verification](docs/TESTING.md), [developer notes](docs/DEVELOPMENT.md).
