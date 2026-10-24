# BeastText changelog

All published versions and the earlier release candidates are listed below. A Git tag alone does not mean a release passed its checks or was published.

## [1.1.1] - PowerShell updater and full version history

- Added a reusable PowerShell updater that finds the newest published Windows release, including prereleases, or accepts a specific version.
- Updates reuse checksum-verified installation, preserve documents/settings and support an offline release folder.
- The updater displays this cumulative changelog and saves it beside the installed documentation. CheckOnly previews the available version and history without installing.
- Every future release includes the updater and cumulative changelog as download assets and packages the history in its documentation.

## [1.1.0] - File workflow and appearance

- Replaced the crowded File ribbon with a dedicated document screen for Save, Save as, recent files, Print/preview, templates and Settings.
- Save as writes real Word DOCX, UTF-8 text, HTML, Markdown or BeastText files. Subsequent Save updates the selected destination; PDF creates a separate sharing copy.
- Added format descriptions, cancellation preservation, atomic writes, correctly named backups and protection against external changes across editable formats.
- Added a visible moon/sun theme control and Light/Dark/System choices that persist across restarts. System appearance follows live changes.
- Passed 18 unit tests, nine desktop journeys and Windows packaging/install/reinstall/shortcut/uninstall gates before publication.

## [1.0.4] - First published Windows prerelease

- Normalised Windows 8.3 installation paths to long paths for shortcut ownership and running-process checks.
- Verified install/reinstall and removal of owned shortcuts under paths containing spaces and apostrophes.
- Published the self-contained Windows x64 ZIP, checksum metadata and PowerShell installer/uninstaller after all release gates passed.

## [1.0.3] - Release candidate; not published

- Waited for native keyboard selection to reach ProseMirror before paragraph-editing assertions.
- All seven Windows desktop journeys passed. The shortcut path assertion then exposed an 8.3-path discrepancy, blocking publication.

## [1.0.2] - Release candidate; not published

- Added portable offline US/UK English checking, local context-menu corrections and a persistent personal dictionary.
- Restored editor focus synchronously on tab switches.
- Expanded unit coverage to 17 tests. Windows spelling passed; a keyboard-selection timing failure blocked publication.

## [1.0.1] - Release candidate; not published

- Improved Windows desktop checks for smaller screens, complete crash-process termination, recovery and Save a Copy destination checks.
- Six Windows journeys passed; native spelling suggestions blocked publication and led to the portable dictionary implementation.

## [1.0.0] - Initial implementation; not published

- Added the offline Electron document editor, rich formatting/styles, tabs, tables, images, comments, templates, outline and find/replace.
- Added native documents, atomic saving, backups, crash recovery, DOCX/HTML/Markdown/text conversion, PDF and print preview.
- Added Windows packaging, PowerShell installation/removal, samples, documentation and automated verification.
- Windows desktop check failures blocked the initial release.
