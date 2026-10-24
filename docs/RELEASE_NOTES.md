BeastText 1.1.0 adds a clearer File screen, practical Save as choices and visible dark mode.

- File now opens a dedicated document screen with Save, Save as, recent documents, Print/preview, templates and Settings.
- Save as supports Word DOCX, plain UTF-8 text, HTML, Markdown and BeastText. The chosen format becomes the active destination, so subsequent Ctrl+S updates it. Each choice explains what it preserves. PDF saves a separate sharing copy.
- Cancellation preserves the active destination. Editable formats use atomic writes, backups with the correct extension, and external-change protection. Reselecting a conflicted file is refused.
- A moon/sun title-bar button switches between dark and light. File offers Light/Dark/System appearance. Preferences persist, and System reacts to live appearance changes. Document paper keeps its print colours.

Download Install-BeastText.ps1, release.json and BeastText-1.1.0-win-x64.zip together for offline installation, or use the HTTPS PowerShell command in the README. Close BeastText before updating. Reinstalling at the same root preserves documents and per-user settings/recovery. No Node.js or Word installation is required.

This is an unsigned Windows x64 prerelease. DOCX conversion remains a documented subset; legacy DOC, RTF and ODT are not included. Exact pagination is in print preview/PDF; editing is continuous. Windows IME, high-DPI/accessibility and physical-printer acceptance still need manual verification. See COMPATIBILITY.md, KNOWN_LIMITATIONS.md and TESTING.md for details.

Publication is gated by the build, unit tests, Electron desktop journeys, Windows packaging and install/reinstall/shortcut/uninstall checks. The application is not code-signed.
