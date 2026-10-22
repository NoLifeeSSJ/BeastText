BeastText 1.0.1 is an unsigned Windows x64 prerelease of the offline document editor.

Includes rich text and named paragraph styles, document tabs, heading navigation, find/replace, tables, embedded images, comments, twelve templates, native .beasttext documents, atomic saving, rotating backups, crash recovery, DOCX/HTML/Markdown/text conversion, PDF export and paginated preview.

Download `Install-BeastText.ps1`, `release.json` and `BeastText-1.0.1-win-x64.zip` together, then run the installer in PowerShell. It verifies the ZIP's SHA-256 and installs under `C:\BeastTextV1\App`; Node.js and Microsoft Word are not required. Settings and recovery live separately in `%APPDATA%\BeastText`.

The installer also accepts `-ManifestUrl` for HTTPS release metadata, `-DesktopShortcut`, `-Launch`, and a writable `-Root` location.

This is a prerelease, not a claim of complete Word compatibility. Editing is continuous; exact pagination is provided by print preview/PDF. DOCX is a documented conversion subset. Full tracked changes, floating objects and overlapping comment anchors are not supported. High-DPI/IME/accessibility and physical-printer acceptance still need manual Windows verification. See `docs/COMPATIBILITY.md`, `docs/KNOWN_LIMITATIONS.md` and `docs/TESTING.md` in the source and installed package.

The release workflow gates publication on the build, unit tests, Electron user journeys, package creation and Windows install/reinstall/uninstall checks. The application is not code-signed.
